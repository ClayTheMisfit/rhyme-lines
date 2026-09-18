'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { cloudSyncManager } from '@/lib/cloud-sync/client'
import type {
  CloudDocumentVersionDto,
  CloudDocumentVersionListResponse,
  CloudDocumentVersionMetadata,
} from '@/lib/cloud-sync/contracts'
import { useCloudSyncStore } from '@/store/cloudSyncStore'

type VersionHistoryDialogProps = {
  documentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus?: () => void
}

const reasonLabel: Record<CloudDocumentVersionMetadata['reason'], string> = {
  INITIAL: 'Initial',
  AUTO: 'Automatic',
  LIFECYCLE: 'Lifecycle',
  PRE_RESTORE: 'Before restore',
  RESTORE: 'Restored',
}

const formatTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))

export function VersionHistoryDialog({
  ...props
}: VersionHistoryDialogProps) {
  const accountState = useCloudSyncStore((state) => state.accountState)
  useCloudSyncStore((state) => props.documentId ? state.documentStates[props.documentId] : undefined)
  const target = props.documentId ? cloudSyncManager.getHistoryTarget(props.documentId) : null
  // Each account/document/open-session boundary discards all private history state.
  return <VersionHistorySession key={`${accountState}:${props.documentId}:${target?.cloudDocumentId}:${props.open}`} {...props} />
}

function VersionHistorySession({
  documentId,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: VersionHistoryDialogProps) {
  const active = useRef(true)
  const previewRequest = useRef(0)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const accountState = useCloudSyncStore((state) => state.accountState)
  useCloudSyncStore((state) => documentId ? state.documentStates[documentId] : undefined)
  const [versions, setVersions] = useState<CloudDocumentVersionMetadata[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<CloudDocumentVersionDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [confirmingRestore, setConfirmingRestore] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)

  const target = documentId ? cloudSyncManager.getHistoryTarget(documentId) : null
  const targetCloudDocumentId = target?.cloudDocumentId ?? null
  const currentRevision = target?.currentRevision ?? null
  const restoreEligibility = documentId
    ? cloudSyncManager.getRestoreEligibility(documentId)
    : { allowed: false as const, reason: 'Open a document first.' }

  const fetchPage = useCallback(async (cursor: string | null, append: boolean) => {
    if (!targetCloudDocumentId) return
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ limit: '20' })
      if (cursor) query.set('cursor', cursor)
      const response = await fetch(`/api/cloud/documents/${encodeURIComponent(targetCloudDocumentId)}/versions?${query}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('history unavailable')
      let payload = await response.json() as CloudDocumentVersionListResponse
      if (!active.current) return
      const bootstrapEligibility = documentId ? cloudSyncManager.getRestoreEligibility(documentId) : null
      if (!append && payload.versions.length === 0 && bootstrapEligibility?.allowed) {
        const checkpoint = await fetch(`/api/cloud/documents/${encodeURIComponent(targetCloudDocumentId)}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision: bootstrapEligibility.baseRevision, reason: 'AUTO' }),
        })
        if (checkpoint.ok) {
          const retry = await fetch(`/api/cloud/documents/${encodeURIComponent(targetCloudDocumentId)}/versions?limit=20`, {
            cache: 'no-store',
          })
          if (retry.ok) payload = await retry.json() as CloudDocumentVersionListResponse
        }
      }
      if (!active.current) return
      setVersions((current) => append ? [...current, ...payload.versions] : payload.versions)
      setNextCursor(payload.nextCursor)
    } catch {
      if (active.current) setError('Version history could not be loaded.')
    } finally {
      if (active.current) {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    }
  }, [documentId, targetCloudDocumentId])

  useEffect(() => {
    if (!open) return
    setVersions([])
    setSelected(null)
    setConfirmingRestore(false)
    setRestoreMessage(null)
    if (!targetCloudDocumentId) {
      setError(accountState === 'anonymous' ? 'Sign in and sync this document to use Version History.' : 'Sync this document to use Version History.')
      return
    }
    void fetchPage(null, false)
  }, [accountState, fetchPage, open, targetCloudDocumentId])

  const selectVersion = async (version: CloudDocumentVersionMetadata) => {
    if (!targetCloudDocumentId) return
    const request = ++previewRequest.current
    setSelected(null)
    setPreviewLoading(true)
    setPreviewError(null)
    setConfirmingRestore(false)
    setRestoreMessage(null)
    try {
      const response = await fetch(
        `/api/cloud/documents/${encodeURIComponent(targetCloudDocumentId)}/versions/${encodeURIComponent(version.id)}`,
        { cache: 'no-store' }
      )
      if (!response.ok) throw new Error('preview unavailable')
      const payload = await response.json() as { version: CloudDocumentVersionDto }
      if (active.current && request === previewRequest.current) setSelected(payload.version)
    } catch {
      if (active.current && request === previewRequest.current) setPreviewError('This version could not be loaded.')
    } finally {
      if (active.current && request === previewRequest.current) setPreviewLoading(false)
    }
  }

  const restoreSelected = async () => {
    if (!documentId || !selected) return
    setRestoring(true)
    setRestoreMessage(null)
    const result = await cloudSyncManager.restoreVersion(documentId, selected.id)
    if (!active.current) return
    setRestoring(false)
    setConfirmingRestore(false)
    if (!result.ok) {
      setRestoreMessage(result.message)
      return
    }
    setRestoreMessage(`Restored as revision ${result.document.revision}.`)
    await fetchPage(null, false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          className="left-1/2 top-1/2 grid h-[min(720px,calc(100vh-2rem))] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)] text-[color:var(--rl-shell-text)] shadow-2xl"
          onCloseAutoFocus={(event) => {
            if (!onCloseAutoFocus) return
            event.preventDefault()
            onCloseAutoFocus()
          }}
        >
          <div className="flex items-start justify-between border-b border-[color:var(--rl-shell-border)] px-5 py-4">
            <div>
              <DialogTitle className="text-base font-semibold">Version History</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-[color:var(--rl-shell-muted)]">
                Immutable checkpoints for this synced document.
              </DialogDescription>
            </div>
            <button type="button" aria-label="Close Version History" onClick={() => onOpenChange(false)} className="rounded-sm px-2 py-1 text-sm text-[color:var(--rl-shell-muted)] hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]">✕</button>
          </div>

          <div className="grid min-h-0 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
            <section aria-label="Historical versions" className="min-h-0 overflow-y-auto border-b border-[color:var(--rl-shell-border)] p-3 md:border-b-0 md:border-r">
              {loading ? <p role="status" className="p-3 text-sm text-[color:var(--rl-shell-muted)]">Loading history…</p> : null}
              {!loading && error ? <p role="alert" className="p-3 text-sm text-amber-300/90">{error}</p> : null}
              {!loading && !error && versions.length === 0 ? <p className="p-3 text-sm text-[color:var(--rl-shell-muted)]">No version history yet.</p> : null}
              <div className="space-y-1" role="list">
                {versions.map((version) => {
                  const current = version.sourceRevision === currentRevision
                  return (
                    <button
                      key={version.id}
                      type="button"
                      role="listitem"
                      onClick={() => void selectVersion(version)}
                      aria-current={current ? 'true' : undefined}
                      className="w-full rounded-md border border-transparent px-3 py-2 text-left hover:border-[color:var(--rl-shell-border)] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]"
                    >
                      <span className="flex items-center justify-between gap-2 text-xs font-medium"><span>{formatTimestamp(version.createdAt)}</span>{current ? <span className="text-[#f2d000]/90">Current</span> : null}</span>
                      <span className="mt-1 block text-[11px] text-[color:var(--rl-shell-muted)]">Revision {version.sourceRevision} · {reasonLabel[version.reason]} · {version.lifecycle.toLowerCase()}</span>
                    </button>
                  )
                })}
              </div>
              {nextCursor ? <button type="button" disabled={loadingMore} onClick={() => void fetchPage(nextCursor, true)} className="mt-3 w-full rounded-sm border border-[color:var(--rl-shell-border)] px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)] disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load older versions'}</button> : null}
            </section>

            <section aria-label="Version preview" className="flex min-h-0 flex-col p-5">
              {previewLoading ? <p role="status" className="text-sm text-[color:var(--rl-shell-muted)]">Loading preview…</p> : null}
              {previewError ? <p role="alert" className="text-sm text-amber-300/90">{previewError}</p> : null}
              {!selected && !previewLoading && !previewError ? <p className="text-sm text-[color:var(--rl-shell-muted)]">Select a version to preview it.</p> : null}
              {selected ? (
                <>
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold">{selected.title}</h3>
                    <p className="mt-1 text-xs text-[color:var(--rl-shell-muted)]">Revision {selected.sourceRevision} · {reasonLabel[selected.reason]} · {formatTimestamp(selected.createdAt)}</p>
                  </div>
                  <pre aria-label="Read-only historical preview" aria-readonly="true" tabIndex={0} className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-md border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-bg)] p-4 font-sans text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]">{selected.lines.map((line) => line.text).join('\n')}</pre>
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    {restoreMessage ? <p role="status" className="mr-auto text-xs text-[color:var(--rl-shell-muted)]">{restoreMessage}</p> : null}
                    {!confirmingRestore ? (
                      <button type="button" disabled={!restoreEligibility.allowed || restoring || selected.sourceRevision === currentRevision} title={!restoreEligibility.allowed ? restoreEligibility.reason : undefined} onClick={() => setConfirmingRestore(true)} className="rounded-sm border border-[color:var(--rl-shell-border)] px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)] disabled:cursor-not-allowed disabled:opacity-45">Restore this version</button>
                    ) : (
                      <div role="group" aria-label="Confirm restore" className="flex flex-wrap items-center justify-end gap-2">
                        <p className="w-full text-right text-xs text-[color:var(--rl-shell-muted)]">Your current synced version will be preserved first.</p>
                        <button type="button" onClick={() => setConfirmingRestore(false)} className="rounded-sm px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]">Cancel</button>
                        <button type="button" disabled={restoring} onClick={() => void restoreSelected()} className="rounded-sm border border-[#f2d000]/40 bg-[#f2d000]/10 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/50 disabled:opacity-50">{restoring ? 'Restoring…' : 'Confirm restore'}</button>
                      </div>
                    )}
                  </div>
                  {!restoreEligibility.allowed ? <p className="mt-2 text-right text-xs text-amber-300/90">{restoreEligibility.reason}</p> : null}
                </>
              ) : null}
            </section>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
