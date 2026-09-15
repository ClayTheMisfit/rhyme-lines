'use client'

import type { PersistenceLoadStatus } from '@/lib/persist/migrations'
import type { DraftCollection, DraftSchema } from '@/lib/persist/schema'
import {
  getAuthoritativeDraftCollection,
  replaceAuthoritativeDraftCollection,
  subscribeDraftPersistence,
} from '@/lib/persist/draftCoordinator'
import { isEditorVisibleDraft, resolveActiveDraftId } from '@/lib/projects/lifecycle'
import { useCloudSyncStore } from '@/store/cloudSyncStore'
import type { CloudAccountState } from '@/store/cloudSyncStore'
import type {
  CloudDocumentDto,
  CloudDocumentInput,
  CloudDocumentListResponse,
  RestoreEligibility,
  RestoreVersionResult,
} from './contracts'
import { HistoryCheckpointScheduler } from './historyScheduler'
import {
  emptyDocumentMetadata,
  ensureAccountMetadata,
  readCloudSyncMetadata,
  writeCloudSyncMetadata,
  type AccountSyncMetadata,
  type CloudSyncMetadata,
  type DocumentSyncMetadata,
} from './metadata'

export const CLOUD_SYNC_MAX_RETRIES = 5
export const CLOUD_SYNC_BASE_RETRY_MS = 1_000
export const CLOUD_SYNC_MAX_RETRY_MS = 30_000
export const getCloudSyncRetryDelay = (attempt: number) =>
  Math.min(CLOUD_SYNC_BASE_RETRY_MS * 2 ** Math.max(0, attempt - 1), CLOUD_SYNC_MAX_RETRY_MS)

export const evaluateRestoreEligibility = (input: {
  online: boolean
  accountState: CloudAccountState
  association?: DocumentSyncMetadata
  inFlight: boolean
  localMatches: boolean
}): RestoreEligibility => {
  if (!input.online || input.association?.state === 'offline') return { allowed: false, reason: 'Reconnect before restoring.' }
  if (input.accountState === 'account-switch' || input.association?.state === 'account-switch') {
    return { allowed: false, reason: 'Confirm the active account before restoring.' }
  }
  if (input.accountState === 'auth-required' || input.association?.state === 'auth-required') {
    return { allowed: false, reason: 'Sign in before restoring.' }
  }
  if (input.accountState !== 'ready') return { allowed: false, reason: 'Sign in before restoring.' }
  const association = input.association
  if (!association) return { allowed: false, reason: 'Sync this document before restoring.' }
  if (association.state === 'conflict') return { allowed: false, reason: 'Resolve the sync conflict before restoring.' }
  if (association.state !== 'synced'
    || input.inFlight
    || association.pendingPermanentDelete
    || !input.localMatches
    || !association.cloudDocumentId
    || !association.lastKnownServerRevision) {
    return { allowed: false, reason: 'Finish syncing before restoring.' }
  }
  return {
    allowed: true,
    cloudDocumentId: association.cloudDocumentId,
    baseRevision: association.lastKnownServerRevision,
  }
}

export const requestHistoryCheckpoint = async (cloudDocumentId: string, expectedRevision: number): Promise<boolean> => {
  try {
    const response = await fetch(`/api/cloud/documents/${encodeURIComponent(cloudDocumentId)}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision, reason: 'AUTO' }),
    })
    return response.ok
  } catch {
    return false
  }
}

type AccountResponse = { user: { id: string; name: string | null; email: string | null } | null }

const lifecycleForDraft = (draft: DraftSchema): CloudDocumentInput['lifecycle'] =>
  draft.deletedAt ? 'TRASHED' : draft.archived || draft.archivedAt ? 'ARCHIVED' : 'ACTIVE'

export const localDocumentVersion = (draft: DraftSchema): string => [
  draft.updatedAt,
  lifecycleForDraft(draft),
  draft.archivedAt ?? '',
  draft.deletedAt ?? '',
  draft.isPinned === true ? 1 : 0,
  draft.position ?? draft.updatedAt,
].join(':')

export const draftToCloudInput = (draft: DraftSchema): CloudDocumentInput => ({
  clientDocumentId: draft.docId,
  title: draft.title?.trim() || 'Untitled',
  lines: draft.lines.map((line) => ({ id: line.id, text: line.text })),
  clientCreatedAt: draft.createdAt,
  clientUpdatedAt: draft.updatedAt,
  lifecycle: lifecycleForDraft(draft),
  lifecycleChangedAt: draft.deletedAt ?? draft.archivedAt ?? null,
  isPinned: draft.isPinned === true,
  position: draft.position ?? draft.updatedAt,
})

const cloudToDraft = (document: CloudDocumentDto, previous?: DraftSchema): DraftSchema => ({
  docId: document.clientDocumentId,
  title: document.title ?? 'Untitled',
  createdAt: document.clientCreatedAt,
  updatedAt: document.clientUpdatedAt,
  archived: document.lifecycle === 'ARCHIVED',
  archivedAt: document.lifecycle === 'ARCHIVED' ? document.lifecycleChangedAt : null,
  deletedAt: document.lifecycle === 'TRASHED' ? document.deletedAt ?? document.lifecycleChangedAt : null,
  folderId: previous?.folderId ?? null,
  isPinned: document.isPinned,
  position: document.position,
  lines: document.lines?.length ? document.lines : [{ id: `${document.clientDocumentId}-line-0`, text: '' }],
  selection: previous?.selection,
})

const isMeaningfulDraft = (draft: DraftSchema) =>
  !((draft.docId === 'placeholder' || draft.docId.startsWith('draft-'))
    && (draft.title?.trim() || 'Untitled') === 'Untitled'
    && draft.lines.every((line) => line.text.trim().length === 0))

const equivalent = (document: CloudDocumentDto, draft: DraftSchema) => {
  const input = draftToCloudInput(draft)
  return document.clientDocumentId === input.clientDocumentId
    && document.title === input.title
    && document.clientCreatedAt === input.clientCreatedAt
    && document.clientUpdatedAt === input.clientUpdatedAt
    && document.lifecycle === input.lifecycle
    && document.isPinned === input.isPinned
    && document.position === input.position
    && JSON.stringify(document.lines) === JSON.stringify(input.lines)
}

class CloudSyncManager {
  private started = false
  private draftsStatus: PersistenceLoadStatus = 'unavailable'
  private accountId: string | null = null
  private metadata: CloudSyncMetadata = readCloudSyncMetadata()
  private unsubscribe: (() => void) | null = null
  private inFlight = new Set<string>()
  private retryTimers = new Map<string, number>()
  private suppressAcknowledgement = false
  private historyScheduler = new HistoryCheckpointScheduler()

  start(draftsStatus: PersistenceLoadStatus | null) {
    if (this.started || !draftsStatus) return
    this.started = true
    this.draftsStatus = draftsStatus
    this.metadata = readCloudSyncMetadata()
    this.unsubscribe = subscribeDraftPersistence((event) => {
      if (this.suppressAcknowledgement || event.type !== 'success' || !event.wrote || !this.accountId) return
      this.queueAcknowledgedCollection()
    })
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('focus', this.handleFocus)
    void this.refreshAccountAndBootstrap()
  }

  private handleOnline = () => {
    if (!this.accountId) return
    this.queueAcknowledgedCollection()
    this.pump()
  }

  private handleFocus = () => { void this.refreshAccountAndBootstrap() }

  private publish(account?: AccountSyncMetadata) {
    if (!account) return
    useCloudSyncStore.getState().actions.replaceDocumentStates(
      Object.fromEntries(Object.entries(account.associations).map(([id, value]) => [id, value.state]))
    )
  }

  private persist(account?: AccountSyncMetadata) {
    writeCloudSyncMetadata(this.metadata)
    this.publish(account)
  }

  private async refreshAccountAndBootstrap() {
    try {
      const response = await fetch('/api/account', { cache: 'no-store' })
      if (!response.ok) throw new Error('account-unavailable')
      const payload = await response.json() as AccountResponse
      if (!payload.user) {
        this.historyScheduler.clear()
        this.accountId = null
        useCloudSyncStore.getState().actions.setAccountState('anonymous')
        return
      }
      const accountId = payload.user.id
      if (this.metadata.lastAccountId && this.metadata.lastAccountId !== accountId) {
        this.historyScheduler.clear()
        this.accountId = null
        useCloudSyncStore.getState().actions.setAccountState('account-switch')
        const account = ensureAccountMetadata(this.metadata, accountId)
        for (const localId of Object.keys(account.associations)) account.associations[localId].state = 'account-switch'
        this.persist(account)
        return
      }
      this.accountId = accountId
      this.metadata.lastAccountId = accountId
      const account = ensureAccountMetadata(this.metadata, accountId)
      for (const association of Object.values(account.associations)) {
        if (association.state === 'auth-required') association.state = navigator.onLine ? 'pending' : 'offline'
      }
      useCloudSyncStore.getState().actions.setAccountState('ready')
      this.persist(account)
      const cloudResponse = await fetch('/api/cloud/documents', { cache: 'no-store' })
      if (cloudResponse.status === 401) return this.pauseForAuthentication(account)
      if (!cloudResponse.ok) throw new Error('cloud-unavailable')
      await this.reconcile(await cloudResponse.json() as CloudDocumentListResponse, account)
    } catch {
      if (!this.accountId) useCloudSyncStore.getState().actions.setAccountState('error')
      else {
        const account = ensureAccountMetadata(this.metadata, this.accountId)
        for (const association of Object.values(account.associations)) {
          if (association.state !== 'conflict') association.state = navigator.onLine ? 'error' : 'offline'
        }
        this.persist(account)
      }
    }
  }

  private async reconcile(cloud: CloudDocumentListResponse, account: AccountSyncMetadata) {
    const collection = getAuthoritativeDraftCollection()
    const meaningful = collection.drafts.filter(isMeaningfulDraft)
    const localById = new Map(meaningful.map((draft) => [draft.docId, draft]))
    if (this.draftsStatus === 'missing' && meaningful.length === 0 && !account.initialized) {
      const imported = cloud.documents.map((document) => cloudToDraft(document))
      if (imported.length) this.replaceFromCloud({ drafts: imported, activeId: resolveActiveDraftId(imported, imported.find(isEditorVisibleDraft)?.docId ?? null), folders: collection.folders ?? [] })
      for (const document of [...cloud.documents, ...cloud.tombstones]) {
        account.associations[document.clientDocumentId] = this.syncedMetadata(document, imported.find((draft) => draft.docId === document.clientDocumentId))
      }
      account.initialized = true
      this.persist(account)
      for (const [localId, association] of Object.entries(account.associations)) {
        if (association.state === 'synced' && association.lastKnownServerRevision) {
          this.scheduleHistoryCheckpoint(localId, association.lastKnownServerRevision)
        }
      }
      this.queueAcknowledgedCollection()
      return
    }

    const additions: DraftSchema[] = []
    const replacements = new Map<string, DraftSchema>()
    const removals = new Set<string>()
    const explicitlyEmptyEstablishedDevice = account.initialized && meaningful.length === 0

    for (const document of cloud.documents) {
      const local = localById.get(document.clientDocumentId)
      const association = account.associations[document.clientDocumentId]
      if (!local) {
        if (!explicitlyEmptyEstablishedDevice) {
          const imported = cloudToDraft(document)
          additions.push(imported)
          account.associations[document.clientDocumentId] = this.syncedMetadata(document, imported)
        }
        continue
      }
      if (!association) {
        account.associations[local.docId] = equivalent(document, local)
          ? this.syncedMetadata(document, local)
          : { ...emptyDocumentMetadata(), cloudDocumentId: document.id, lastKnownServerRevision: document.revision, lastKnownLifecycle: document.lifecycle, state: 'conflict', lastError: 'Cloud and local versions both exist' }
        continue
      }
      association.cloudDocumentId = document.id
      association.lastKnownLifecycle = document.lifecycle
      if ((association.lastKnownServerRevision ?? 0) < document.revision) {
        if (association.lastSyncedLocalVersion === localDocumentVersion(local)) {
          const replacement = cloudToDraft(document, local)
          replacements.set(local.docId, replacement)
          account.associations[local.docId] = this.syncedMetadata(document, replacement)
        } else {
          association.state = 'conflict'
          association.lastError = 'Cloud version changed while local work was pending'
          association.lastKnownServerRevision = document.revision
        }
      }
    }

    for (const tombstone of cloud.tombstones) {
      const local = localById.get(tombstone.clientDocumentId)
      const association = account.associations[tombstone.clientDocumentId]
      if (!association) continue
      association.cloudDocumentId = tombstone.id
      association.lastKnownServerRevision = tombstone.revision
      association.lastKnownLifecycle = 'DELETED'
      if (local && association.lastSyncedLocalVersion !== localDocumentVersion(local)) {
        association.state = 'conflict'
        association.lastError = 'Cloud document was deleted while local work changed'
      } else {
        if (local) removals.add(local.docId)
        association.state = 'deleted'
        association.pendingPermanentDelete = false
      }
    }

    if (additions.length || replacements.size || removals.size) {
      const drafts = collection.drafts
        .filter((draft) => !removals.has(draft.docId))
        .map((draft) => replacements.get(draft.docId) ?? draft)
        .concat(additions)
      this.replaceFromCloud({ ...collection, drafts, activeId: resolveActiveDraftId(drafts, collection.activeId) })
    }
    account.initialized = true
    this.persist(account)
    for (const [localId, association] of Object.entries(account.associations)) {
      if (association.state === 'synced' && association.cloudDocumentId && association.lastKnownServerRevision) {
        this.scheduleHistoryCheckpoint(localId, association.lastKnownServerRevision)
      }
    }
    this.queueAcknowledgedCollection()
  }

  private replaceFromCloud(collection: DraftCollection) {
    this.suppressAcknowledgement = true
    try {
      return replaceAuthoritativeDraftCollection(collection, { persist: 'immediate' })
    } finally {
      this.suppressAcknowledgement = false
    }
  }

  private syncedMetadata(document: CloudDocumentDto, draft?: DraftSchema): DocumentSyncMetadata {
    return {
      cloudDocumentId: document.id,
      lastKnownServerRevision: document.revision,
      lastKnownLifecycle: document.lifecycle,
      lastSuccessfulSyncAt: Date.now(),
      lastSyncedLocalVersion: draft ? localDocumentVersion(draft) : null,
      state: document.lifecycle === 'DELETED' ? 'deleted' : 'synced',
      lastError: null,
      attempts: 0,
      nextRetryAt: null,
      pendingPermanentDelete: false,
    }
  }

  private queueAcknowledgedCollection() {
    if (!this.accountId) return
    const account = ensureAccountMetadata(this.metadata, this.accountId)
    const collection = getAuthoritativeDraftCollection()
    for (const draft of collection.drafts.filter(isMeaningfulDraft)) {
      const association = account.associations[draft.docId] ??= emptyDocumentMetadata()
      if (association.state === 'conflict' || association.state === 'deleted') continue
      if (association.pendingPermanentDelete) {
        association.state = navigator.onLine ? 'pending' : 'offline'
        continue
      }
      if (association.lastSyncedLocalVersion !== localDocumentVersion(draft)) {
        association.state = navigator.onLine ? 'pending' : 'offline'
        association.lastError = null
      }
    }
    this.persist(account)
    this.pump()
  }

  markPermanentDeletion(localDocumentId: string) {
    if (!this.accountId) return
    const account = ensureAccountMetadata(this.metadata, this.accountId)
    const association = account.associations[localDocumentId] ??= emptyDocumentMetadata()
    association.pendingPermanentDelete = true
    association.state = navigator.onLine ? 'pending' : 'offline'
    this.persist(account)
    this.pump()
  }

  private pump() {
    if (!this.accountId || !navigator.onLine) return
    const account = ensureAccountMetadata(this.metadata, this.accountId)
    for (const [localId, association] of Object.entries(account.associations)) {
      if ((association.state !== 'pending' && association.state !== 'offline') || this.inFlight.has(localId)) continue
      if (association.nextRetryAt && association.nextRetryAt > Date.now()) {
        this.scheduleRetry(localId, association.nextRetryAt - Date.now())
        continue
      }
      void this.syncOne(localId, association, account)
    }
  }

  private async syncOne(localId: string, association: DocumentSyncMetadata, account: AccountSyncMetadata) {
    this.inFlight.add(localId)
    let completed = false
    association.state = 'syncing'
    this.persist(account)
    try {
      let response: Response
      let sentDraft: DraftSchema | undefined
      if (association.pendingPermanentDelete && (!association.cloudDocumentId || !association.lastKnownServerRevision)) {
        response = await fetch('/api/cloud/documents', { cache: 'no-store' })
        if (response.status === 401) return this.pauseForAuthentication(account)
        if (!response.ok) throw new Error('transient')
        const listing = await response.json() as CloudDocumentListResponse
        const document = [...listing.documents, ...listing.tombstones]
          .find((candidate) => candidate.clientDocumentId === localId)
        if (!document) {
          association.pendingPermanentDelete = false
          association.state = 'deleted'
          association.lastError = null
          return
        }
        association.cloudDocumentId = document.id
        association.lastKnownServerRevision = document.revision
        association.lastKnownLifecycle = document.lifecycle
        if (document.lifecycle === 'DELETED') {
          association.pendingPermanentDelete = false
          association.state = 'deleted'
        } else {
          association.state = 'pending'
        }
        return
      }
      if (association.pendingPermanentDelete && association.cloudDocumentId && association.lastKnownServerRevision) {
        const needsTrashTransition = association.lastKnownLifecycle !== 'TRASHED'
        response = await fetch(`/api/cloud/documents/${encodeURIComponent(association.cloudDocumentId)}`, {
          method: needsTrashTransition ? 'PATCH' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(needsTrashTransition
            ? { action: 'trash', baseRevision: association.lastKnownServerRevision }
            : { baseRevision: association.lastKnownServerRevision }),
        })
      } else {
        const draft = getAuthoritativeDraftCollection().drafts.find((candidate) => candidate.docId === localId)
        if (!draft) return
        sentDraft = draft
        const input = draftToCloudInput(draft)
        if (association.cloudDocumentId && association.lastKnownServerRevision) {
          const lifecycleAction = this.lifecycleAction(association.lastKnownLifecycle, input.lifecycle)
          if (lifecycleAction === 'invalid') {
            association.state = 'conflict'
            association.lastError = 'Local lifecycle cannot be reconciled automatically'
            return
          }
          response = lifecycleAction
            ? await fetch(`/api/cloud/documents/${encodeURIComponent(association.cloudDocumentId)}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: lifecycleAction, baseRevision: association.lastKnownServerRevision }),
              })
            : await fetch(`/api/cloud/documents/${encodeURIComponent(association.cloudDocumentId)}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...input, baseRevision: association.lastKnownServerRevision }),
              })
        } else {
          response = await fetch('/api/cloud/documents', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
          })
        }
      }

      if (response.status === 401) return this.pauseForAuthentication(account)
      if (response.status === 409) {
        const conflict = await response.json() as { currentRevision?: number }
        association.state = 'conflict'
        association.lastError = 'Cloud version changed'
        if (Number.isInteger(conflict.currentRevision)) association.lastKnownServerRevision = conflict.currentRevision!
        return
      }
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          association.state = 'error'
          association.lastError = 'Cloud rejected this document'
          association.attempts = CLOUD_SYNC_MAX_RETRIES
          return
        }
        throw new Error('transient')
      }
      const payload = await response.json() as { document: CloudDocumentDto }
      const continuePermanentDeletion = association.pendingPermanentDelete && payload.document.lifecycle !== 'DELETED'
      if (!association.pendingPermanentDelete && sentDraft && !equivalent(payload.document, sentDraft)) {
        association.cloudDocumentId = payload.document.id
        association.lastKnownServerRevision = payload.document.revision
        association.state = 'conflict'
        association.lastError = 'Existing cloud document differs from this local document'
        return
      }
      Object.assign(association, this.syncedMetadata(payload.document, sentDraft))
      if (payload.document.lifecycle !== 'DELETED') {
        this.scheduleHistoryCheckpoint(localId, payload.document.revision)
      } else {
        this.historyScheduler.cancel(localId)
      }
      if (continuePermanentDeletion) {
        association.pendingPermanentDelete = true
        association.state = 'pending'
      }
      completed = true
    } catch {
      association.attempts += 1
      if (!navigator.onLine) {
        association.state = 'offline'
        association.lastError = null
        association.nextRetryAt = null
      } else if (association.attempts >= CLOUD_SYNC_MAX_RETRIES) {
        association.state = 'error'
        association.lastError = 'Cloud sync paused after repeated failures'
        association.nextRetryAt = null
      } else {
        association.state = 'pending'
        association.lastError = 'Cloud sync will retry'
        const delay = getCloudSyncRetryDelay(association.attempts)
        association.nextRetryAt = Date.now() + delay
        this.scheduleRetry(localId, delay)
      }
    } finally {
      this.inFlight.delete(localId)
      this.persist(account)
      const current = getAuthoritativeDraftCollection().drafts.find((candidate) => candidate.docId === localId)
      if (completed && current && association.lastSyncedLocalVersion !== localDocumentVersion(current)) {
        association.state = 'pending'
        this.persist(account)
      }
      this.pump()
    }
  }

  private pauseForAuthentication(account: AccountSyncMetadata) {
    useCloudSyncStore.getState().actions.setAccountState('auth-required')
    for (const association of Object.values(account.associations)) {
      if (!['synced', 'deleted', 'conflict'].includes(association.state)) association.state = 'auth-required'
    }
    this.persist(account)
  }

  private lifecycleAction(
    from: DocumentSyncMetadata['lastKnownLifecycle'],
    to: CloudDocumentInput['lifecycle']
  ): 'archive' | 'restore-archive' | 'trash' | 'restore-trash' | 'invalid' | null {
    if (!from || from === to) return null
    if (from === 'ACTIVE' && to === 'ARCHIVED') return 'archive'
    if (from === 'ARCHIVED' && to === 'ACTIVE') return 'restore-archive'
    if ((from === 'ACTIVE' || from === 'ARCHIVED') && to === 'TRASHED') return 'trash'
    if (from === 'TRASHED' && to === 'ACTIVE') return 'restore-trash'
    return 'invalid'
  }

  private scheduleRetry(localId: string, delay: number) {
    const existing = this.retryTimers.get(localId)
    if (existing) window.clearTimeout(existing)
    this.retryTimers.set(localId, window.setTimeout(() => {
      this.retryTimers.delete(localId)
      this.pump()
    }, Math.max(0, delay)))
  }

  private scheduleHistoryCheckpoint(localId: string, expectedRevision: number) {
    this.historyScheduler.schedule(localId, expectedRevision, (revision) => {
      void this.createHistoryCheckpoint(localId, revision)
    })
  }

  private async createHistoryCheckpoint(localId: string, expectedRevision: number) {
    if (!this.accountId || !navigator.onLine) return
    const account = ensureAccountMetadata(this.metadata, this.accountId)
    const association = account.associations[localId]
    if (!association
      || association.state !== 'synced'
      || association.pendingPermanentDelete
      || association.lastKnownServerRevision !== expectedRevision
      || !association.cloudDocumentId
      || this.inFlight.has(localId)) return
    // History is secondary. The result never changes canonical sync state.
    await requestHistoryCheckpoint(association.cloudDocumentId, expectedRevision)
  }

  getRestoreEligibility(localId: string): RestoreEligibility {
    const association = this.accountId
      ? ensureAccountMetadata(this.metadata, this.accountId).associations[localId]
      : undefined
    const local = getAuthoritativeDraftCollection().drafts.find((draft) => draft.docId === localId)
    return evaluateRestoreEligibility({
      online: navigator.onLine,
      accountState: useCloudSyncStore.getState().accountState,
      association,
      inFlight: this.inFlight.has(localId),
      localMatches: Boolean(local && association?.lastSyncedLocalVersion === localDocumentVersion(local)),
    })
  }

  getHistoryTarget(localId: string): { cloudDocumentId: string; currentRevision: number } | null {
    if (!this.accountId || useCloudSyncStore.getState().accountState !== 'ready') return null
    const association = ensureAccountMetadata(this.metadata, this.accountId).associations[localId]
    if (!association?.cloudDocumentId
      || !association.lastKnownServerRevision
      || association.state === 'deleted'
      || association.lastKnownLifecycle === 'DELETED') return null
    return {
      cloudDocumentId: association.cloudDocumentId,
      currentRevision: association.lastKnownServerRevision,
    }
  }

  async restoreVersion(localId: string, versionId: string): Promise<RestoreVersionResult> {
    const eligibility = this.getRestoreEligibility(localId)
    if (!eligibility.allowed) return { ok: false, kind: 'blocked', message: eligibility.reason }
    const accountId = this.accountId
    if (!accountId) return { ok: false, kind: 'blocked', message: 'Sign in before restoring.' }
    const account = ensureAccountMetadata(this.metadata, accountId)
    const association = account.associations[localId]
    const localAtStart = getAuthoritativeDraftCollection().drafts.find((draft) => draft.docId === localId)
    const localVersionAtStart = localAtStart ? localDocumentVersion(localAtStart) : null
    this.historyScheduler.cancel(localId)
    this.inFlight.add(localId)
    try {
      const response = await fetch(
        `/api/cloud/documents/${encodeURIComponent(eligibility.cloudDocumentId)}/versions/${encodeURIComponent(versionId)}/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseRevision: eligibility.baseRevision }),
        }
      )
      if (response.status === 409) {
        const conflict = await response.json() as { currentRevision?: number }
        association.state = 'conflict'
        association.lastError = 'Cloud version changed before restore'
        if (Number.isInteger(conflict.currentRevision)) association.lastKnownServerRevision = conflict.currentRevision!
        this.persist(account)
        return { ok: false, kind: 'conflict', message: 'The cloud document changed. Refresh before restoring.' }
      }
      if (!response.ok) return { ok: false, kind: 'failed', message: 'This version could not be restored.' }
      const payload = await response.json() as { document: CloudDocumentDto }
      if (this.accountId !== accountId || useCloudSyncStore.getState().accountState !== 'ready') {
        return { ok: false, kind: 'blocked', message: 'The active account changed. Local content was preserved.' }
      }
      const collection = getAuthoritativeDraftCollection()
      const previous = collection.drafts.find((draft) => draft.docId === localId)
      if (!previous) return { ok: false, kind: 'failed', message: 'The local document is unavailable.' }
      if (localVersionAtStart !== localDocumentVersion(previous)) {
        association.state = 'conflict'
        association.lastError = 'Local work changed while a version was being restored'
        association.lastKnownServerRevision = payload.document.revision
        this.persist(account)
        return { ok: false, kind: 'conflict', message: 'Local changes were preserved. Resolve the sync conflict before continuing.' }
      }
      const restoredDraft = cloudToDraft(payload.document, previous)
      const persistence = this.replaceFromCloud({
        ...collection,
        drafts: collection.drafts.map((draft) => draft.docId === localId ? restoredDraft : draft),
      })
      if (!persistence?.ok) {
        association.cloudDocumentId = payload.document.id
        association.lastKnownServerRevision = payload.document.revision
        association.state = 'error'
        association.lastError = 'Restored cloud version could not be saved locally'
        this.persist(account)
        return { ok: false, kind: 'failed', message: 'The cloud restore succeeded, but the local copy could not be saved.' }
      }
      Object.assign(association, this.syncedMetadata(payload.document, restoredDraft))
      this.persist(account)
      this.scheduleHistoryCheckpoint(localId, payload.document.revision)
      return { ok: true, document: payload.document }
    } catch {
      return { ok: false, kind: 'failed', message: 'This version could not be restored.' }
    } finally {
      this.inFlight.delete(localId)
      this.pump()
    }
  }

  signOut() {
    this.historyScheduler.clear()
    this.accountId = null
    useCloudSyncStore.getState().actions.setAccountState('anonymous')
  }

  resetForTests() {
    this.unsubscribe?.()
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('focus', this.handleFocus)
    for (const timer of this.retryTimers.values()) window.clearTimeout(timer)
    this.started = false
    this.accountId = null
    this.unsubscribe = null
    this.inFlight.clear()
    this.retryTimers.clear()
    this.historyScheduler.clear()
    this.metadata = readCloudSyncMetadata()
    useCloudSyncStore.getState().actions.reset()
  }
}

export const cloudSyncManager = new CloudSyncManager()
export const recordPermanentDeletionAfterLocalAck = (localDocumentId: string) => cloudSyncManager.markPermanentDeletion(localDocumentId)
export const pauseCloudSyncForSignOut = () => cloudSyncManager.signOut()
export const resetCloudSyncForTests = () => cloudSyncManager.resetForTests()
