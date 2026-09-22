'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { cloudSyncManager, conflictLocalMarker, lifecycleForDraft, type ConflictAction, type ConflictPreview } from '@/lib/cloud-sync/client'
import { getAuthoritativeDraftCollection, subscribeDraftCollection } from '@/lib/persist/draftCoordinator'
import { useCloudSyncStore } from '@/store/cloudSyncStore'

const button = 'rounded-sm border border-[color:var(--rl-shell-border)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-text)] disabled:opacity-45'
const labels: Record<ConflictAction, string> = { 'keep-local': 'Keep Local', 'use-cloud': 'Use Cloud', 'save-both': 'Save Both' }
const time = (value: number | string) => new Date(value).toLocaleString()
type Props = { documentId: string; open: boolean; onOpenChange: (open: boolean) => void; onCloseAutoFocus?: () => void }

export function ConflictResolutionDialog(props: Props) {
  const accountState = useCloudSyncStore((state) => state.accountState)
  useCloudSyncStore((state) => state.documentStates[props.documentId])
  const target = cloudSyncManager.getConflictTarget(props.documentId)
  // Remounting discards private fetched lyrics and pending confirmation on identity changes.
  return <ConflictSession key={`${accountState}:${target}:${props.documentId}:${props.open}`} {...props} />
}

function ConflictSession({ documentId, open, onOpenChange, onCloseAutoFocus }: Props) {
  const active = useRef(true)
  const request = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  const localAtInspection = useRef(getAuthoritativeDraftCollection().drafts.find((draft) => draft.docId === documentId))
  const [preview, setPreview] = useState<ConflictPreview | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<ConflictAction | null>(null)
  const [localChanged, setLocalChanged] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const accountState = useCloudSyncStore((state) => state.accountState)
  const local = preview?.local ?? getAuthoritativeDraftCollection().drafts.find((draft) => draft.docId === documentId)

  useEffect(() => {
    active.current = true
    const connectivity = () => { setOnline(navigator.onLine); setConfirm(null) }
    window.addEventListener('online', connectivity)
    window.addEventListener('offline', connectivity)
    return () => {
      active.current = false
      window.removeEventListener('online', connectivity)
      window.removeEventListener('offline', connectivity)
    }
  }, [])

  const refresh = useCallback(async () => {
    const id = ++request.current
    setBusy(true)
    setConfirm(null)
    setMessage(null)
    try {
      const latest = await cloudSyncManager.inspectConflict(documentId)
      if (active.current && id === request.current) { localAtInspection.current = getAuthoritativeDraftCollection().drafts.find((draft) => draft.docId === documentId); setPreview(latest); setLocalChanged(false) }
    } catch (error) {
      if (active.current && id === request.current) { setPreview(null); setMessage(error instanceof Error ? error.message : 'Cloud preview unavailable.') }
    } finally {
      if (active.current && id === request.current) setBusy(false)
    }
  }, [documentId])

  useEffect(() => { if (open && accountState === 'ready') void refresh() }, [open, accountState, refresh])
  useEffect(() => subscribeDraftCollection((collection) => {
    if (!preview) return
    const current = collection.drafts.find((draft) => draft.docId === documentId)
    // No content comparison in the typing callback. The next user action checks exact state.
    if (current !== localAtInspection.current) { setLocalChanged(true); setConfirm(null) }
  }), [documentId, preview])

  const resolve = async () => {
    if (!confirm || !preview) return
    setBusy(true)
    const result = await cloudSyncManager.resolveConflict(documentId, confirm, preview)
    if (!active.current) return
    setBusy(false)
    setConfirm(null)
    if (result.ok) { onOpenChange(false); return }
    if (result.kind === 'stale') {
      await refresh()
      if (active.current) setMessage('A version changed. Review the refreshed previews and choose again.')
    } else setMessage(result.message)
  }
  const choose = (action: ConflictAction) => {
    const current = getAuthoritativeDraftCollection().drafts.find((draft) => draft.docId === documentId)
    if (!preview || !current || conflictLocalMarker(current) !== preview.localMarker) { setLocalChanged(true); setConfirm(null); return }
    setConfirm(action)
  }
  const block = !online ? 'Reconnect to resolve this conflict.' : cloudSyncManager.getConflictBlock(documentId)
  const disabled = busy || Boolean(block) || !preview || localChanged

  return <Dialog open={open && accountState === 'ready'} onOpenChange={onOpenChange}>
    <DialogPortal><DialogOverlay /><DialogContent onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement | null }} onCloseAutoFocus={(event) => { event.preventDefault(); if (onCloseAutoFocus) onCloseAutoFocus(); else returnFocus.current?.focus() }} className="left-1/2 top-1/2 flex max-h-[calc(100vh-2rem)] w-[min(940px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-auto rounded-lg border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)] p-5 text-[color:var(--rl-shell-text)] shadow-2xl">
      <DialogTitle className="text-base font-semibold">Sync conflict</DialogTitle>
      <DialogDescription className="text-sm text-[color:var(--rl-shell-muted)]">Both versions are preserved. Review the whole document and choose explicitly.</DialogDescription>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Local version">
          <h3 className="font-semibold">Local version · {local ? lifecycleForDraft(local) : 'Unavailable'}</h3>
          <p className="my-2 text-xs">{local?.title} · Last known cloud revision {preview?.localKnownRevision ?? 'unknown'}{local ? ` · Updated ${time(local.updatedAt)}` : ''}</p>
          <pre tabIndex={0} aria-label="Read-only local preview" aria-readonly="true" className="h-64 overflow-auto whitespace-pre-wrap rounded-md bg-[color:var(--rl-shell-bg)] p-3 font-sans text-sm focus-visible:outline focus-visible:outline-2">{local?.lines.map((line) => line.text).join('\n')}</pre>
        </section>
        <section aria-label="Cloud version">
          <h3 className="font-semibold">Cloud version · {preview?.cloud.lifecycle ?? 'Unavailable'}</h3>
          <p className="my-2 text-xs">{preview ? `Revision ${preview.cloud.revision} · Updated ${time(preview.cloud.serverUpdatedAt)}` : 'Refresh to fetch the latest owned cloud state.'}</p>
          <pre tabIndex={0} aria-label="Read-only cloud preview" aria-readonly="true" className="h-64 overflow-auto whitespace-pre-wrap rounded-md bg-[color:var(--rl-shell-bg)] p-3 font-sans text-sm focus-visible:outline focus-visible:outline-2">{preview?.cloud.lifecycle === 'DELETED' ? 'Permanently deleted. The old cloud identity cannot be restored.' : preview?.cloud.lines?.map((line) => line.text).join('\n')}</pre>
        </section>
      </div>
      {preview ? <p className="text-xs">Conflict detected {time(preview.detectedAt)}.</p> : null}
      <div aria-live="polite">{busy ? <p>Checking current state…</p> : null}{block ? <p>{block}</p> : null}{localChanged ? <p>Local version changed. Refresh both previews before choosing again.</p> : null}{message ? <p role="status">{message}</p> : null}</div>
      <button className={button} disabled={busy || !online || accountState !== 'ready'} onClick={() => void refresh()}>Refresh Cloud Version and Local Preview</button>
      {confirm ? <div role="group" aria-label="Confirm conflict resolution" className="space-y-3">
        <p className="text-sm">{confirm === 'keep-local' && preview?.cloud.lifecycle !== 'DELETED' ? 'Your local version will become a new cloud revision. The previous cloud version remains recoverable in Version History.' : 'Your local version will be preserved as a new active Conflict Copy. The original will adopt the cloud state, including deletion.'}</p>
        <button className={button} disabled={disabled} onClick={() => void resolve()}>Confirm {labels[confirm]}</button>
        <button className={`${button} ml-2`} disabled={busy} onClick={() => setConfirm(null)}>Back</button>
      </div> : <div className="flex flex-wrap gap-2" aria-describedby="conflict-actions-help">
        {(Object.keys(labels) as ConflictAction[]).map((action) => <button className={button} key={action} disabled={disabled} onClick={() => choose(action)}>{labels[action]}</button>)}
      </div>}
      <p id="conflict-actions-help" className="text-xs text-[color:var(--rl-shell-muted)]">Use Cloud and Save Both preserve your local candidate as a recovery copy first. A deleted cloud document stays deleted; Keep Local also saves a new copy in that case. Every action checks the current revisions again.</p>
      <button className={button} onClick={() => onOpenChange(false)}>Cancel</button>
    </DialogContent></DialogPortal>
  </Dialog>
}
