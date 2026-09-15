# Version History Foundation

Version History is available only for authenticated, cloud-synced documents. Anonymous and local-only writing remains unchanged and does not require sign-in.

## Data model and immutability

`CloudDocumentVersion` is an append-only, server-owned snapshot of one accepted `CloudDocument` revision. The unique `(documentId, sourceRevision)` constraint makes retries idempotent. Rows belong to both the parent document and its authenticated owner and are indexed by document/time, document/revision, and user.

Snapshots contain only canonical cloud document fields required for restoration: title, lyric lines in `content`, lifecycle and its transition timestamp, pin/order metadata, client creation/update timestamps, source revision, reason, and checkpoint creation time. Caret, selection, scroll position, theme, panels, tabs, analysis output, rhyme data, and other device UI state are not stored.

No update route exists for a historical version. Reasons are `INITIAL`, `AUTO`, `LIFECYCLE`, `PRE_RESTORE`, and `RESTORE`.

## Checkpoint policy

- New cloud documents receive an `INITIAL` checkpoint at revision 1 in the creation transaction.
- Existing pre-history documents receive an idempotent `INITIAL` baseline the first time the current revision enters checkpoint flow. Opening Version History while fully synced also bootstraps an empty history.
- Each successful cloud response schedules an `AUTO` checkpoint 60 seconds after the latest accepted activity. A newer accepted response resets the per-document timer. Reload may schedule the still-current revision again; server uniqueness prevents duplicates.
- Archive, unarchive, trash, and trash restore create immediate `LIFECYCLE` checkpoints in the lifecycle transaction.
- Manual checkpoint UI is not implemented in Phase 1.
- Automatic pruning is not implemented. Storage retention is a future product decision; permanent-deletion privacy is handled separately.

The browser sends only document identity, expected server revision, and the allowed automatic intent. The authenticated server verifies ownership and revision, then copies the canonical `CloudDocument`. Client-supplied lyric content is never accepted as history.

Checkpoint errors are secondary: they do not change local `Saved` acknowledgement, canonical cloud sync state, retry/conflict state, or editor usability.

## API and pagination

All routes use `getCurrentUser()`, private no-store responses, parent ownership checks, and generic not-found responses for non-owned IDs.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/cloud/documents/:id/versions?limit=20&cursor=...` | Newest-first metadata page; no lyric content |
| `POST` | `/api/cloud/documents/:id/versions` | Checkpoint canonical state for `expectedRevision` |
| `GET` | `/api/cloud/documents/:id/versions/:versionId` | Fetch one owned immutable snapshot with content |
| `POST` | `/api/cloud/documents/:id/versions/:versionId/restore` | Restore using `baseRevision` |

Pages default to 20 and are capped at 50. The opaque cursor contains the last row's timestamp and ID; server ordering is `createdAt DESC, id DESC` for deterministic traversal.

## Restore contract

Restore is enabled only when the account is ready, the browser is online, the document state is `synced`, no cloud operation or permanent deletion is pending, the local version marker equals the last synchronized marker, and a current server revision is known. Pending, offline, error, conflict, auth-required, and account-switch states are rejected with concise UI guidance.

The request contains the selected version ID and current `baseRevision`. In one Prisma transaction with an atomic conditional revision update, the server:

1. verifies document and version ownership and rejects permanently deleted parents;
2. verifies the current revision still equals `baseRevision`;
3. inserts a `PRE_RESTORE` snapshot for the current revision when that revision is not already checkpointed;
4. conditionally copies the selected snapshot into `CloudDocument` and increments the monotonic revision;
5. inserts a `RESTORE` snapshot for the new current revision.

A stale base returns HTTP 409 and rolls back the entire transaction. Historical rows are never mutated and the server revision never rewinds.

After success, `CloudSyncManager` converts the returned canonical document to a `Draft`, sets account-scoped revision/version metadata, and installs it through `draftCoordinator.replaceAuthoritativeDraftCollection` with immediate local acknowledgement suppression. This recognizes the returned revision as synchronized and avoids an N+2 upload. If local content changes while the request is in flight, local content is preserved and the document enters conflict rather than being overwritten.

## Lifecycle, deletion, accounts, and privacy

Archive and trash history remains available. Permanent deletion is different: in the same transaction as tombstone redaction, every version row for the document is deleted. The redacted `CloudDocument` tombstone and monotonic revision remain for stale-device resurrection protection. Version list/get/restore routes reject deleted parents, so permanently deleted lyrics cannot be recovered through history.

Version client state (open panel, selected item, cursors, loading, errors, and confirmation) is component-local and never stored in `Draft`. History transport metadata is account-scoped through the existing cloud association. Account switching clears scheduled checkpoint work and blocks history lookup/restore until the active account is safe. Lyrics are not logged, sent to analytics, or included in error messages. Provider access and refresh tokens are unrelated and are never used by Version History.

## UI and performance boundary

The keyboard-accessible command palette opens a temporary Version History dialog. The list shows timestamp, reason, source revision, lifecycle, and current-revision status. Full content is fetched only after selection and rendered in a focusable, read-only preview. Restore requires a second confirmation action.

Checkpoint scheduling consumes successful cloud-sync responses. No Version History operation was added to editor input, caret/selection handling, analysis scheduling, overlay measurement, or rendering.

## Phase 1 boundaries

Phase 1 intentionally does not include anonymous history, diff rendering, collaboration, CRDTs, shared/public documents, branches, merging, history export, archival storage, analytics, AI summaries, or automatic retention pruning. Cross-device restores use the existing revision-conflict and reconciliation behavior.
