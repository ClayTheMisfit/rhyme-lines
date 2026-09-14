# Cloud sync foundation

Rhyme Lines remains local-first. The editor writes through `tabsStore` and `draftCoordinator`; only a successful local persistence acknowledgement wakes the cloud queue. Network, authentication, or PostgreSQL failures never change the local-save result and never enter the editor input, selection, analysis, or overlay paths.

## Data flow

```text
EditorShell.handleTextChange
  -> useTabsStore
  -> draftCoordinator
  -> DraftPersistenceEvent.success
  -> CloudSyncManager
  -> /api/cloud/documents
  -> cloud document service
  -> Prisma / PostgreSQL
```

Cloud-to-local bootstrap calls `replaceAuthoritativeDraftCollection`; it does not write the canonical draft storage key directly.

## Local and cloud fields

The stable local `DraftSchema.docId` is `CloudDocument.clientDocumentId`. The unique `(userId, clientDocumentId)` constraint is the initial-upload idempotency key.

Cloud domain data includes title, line IDs and text, client creation/modification timestamps, archive/trash lifecycle, pin state, and ordering position. `activeId`, caret `selection`, dirty state, folders/folder assignment, panel state, theme, layout, search, and other editor settings stay device-local in Phase 1. Folder metadata is intentionally deferred until folders have their own owned cloud model.

Cloud transport metadata lives separately at `localStorage['rhyme-lines:cloud-sync:v1']`. It contains account-partitioned cloud IDs, revisions, lifecycle, last-success timestamps, a non-content local version marker, state/error/retry fields, and pending tombstone intent. It never stores lyric text, session tokens, OAuth tokens, or database credentials. `draftCoordinator` remains the sole regular writer of `rhyme-lines:persist:drafts`.

## Ownership and API

Every route resolves `getCurrentUser()` on the server. No request accepts a user ID as authorization authority. All service reads and mutations include the authenticated `userId`; cross-owner IDs receive the same generic `404` used for missing records.

| Method | Route | Purpose | Revision behavior |
| --- | --- | --- | --- |
| `GET` | `/api/cloud/documents` | List the current user's documents and separate tombstones | Read-only |
| `POST` | `/api/cloud/documents` | Idempotent initial upload by stable client ID | Creates revision 1; a retry returns the existing row |
| `GET` | `/api/cloud/documents/:id` | Read one owned document | Read-only |
| `PUT` | `/api/cloud/documents/:id` | Replace content/metadata without changing lifecycle | Atomic match on owner, ID, client ID, lifecycle, and base revision; increments revision |
| `PATCH` | `/api/cloud/documents/:id` | Archive, restore archive, trash, or restore trash | Atomic allowed transition and base-revision match; increments revision |
| `DELETE` | `/api/cloud/documents/:id` | Permanently delete an already-trashed document | Creates a redacted tombstone and increments revision |

Payloads are runtime-validated. Titles are limited to 100 characters, client/line IDs are bounded, line count is limited to 20,000, aggregate content is limited to 1,000,000 characters, and request bodies are limited to 1,100,000 bytes. Browser `userId` fields are ignored and never reach authorization logic. API errors do not expose Prisma details or lyric content.

## Revisions and conflicts

The initial revision is 1. Updates use the client's `baseRevision`. PostgreSQL receives one conditional `updateManyAndReturn` statement matching owner plus revision; no read-then-write race is used. One writer advancing revision 4 to 5 causes a second writer using base 4 to receive `409` with the document ID, expected revision, and current revision. The server remains at revision 5, the stale client's local content remains untouched, and its sync state becomes `conflict`. Phase 1 never resolves a conflict destructively and provides no merge editor.

## Queue, offline, and authentication behavior

The queue records only the latest unsent local version for each document. If another acknowledged edit arrives during an upload, the completed response establishes the next base revision and one follow-up upload sends the newest local snapshot. Transient failures use bounded exponential delays of 1, 2, 4, 8, and 16 seconds, capped at 30 seconds, then pause after five attempts. Validation failures pause immediately. Conflicts do not retry. Offline work remains locally saved with `offline` metadata and resumes on the browser `online` event. A `401` changes state to `auth-required`; successful identity refresh resumes without clearing drafts or associations.

Signing out keeps canonical local drafts and all account partitions. The active cloud manager stops. If a different account signs in on the same browser, the manager enters `account-switch` and makes no cloud document request or upload. Phase 1 prefers a recoverable paused state over guessing which local drafts belong to the new account.

## Bootstrap behavior

- Local-only, first account: upload each meaningful document independently after local acknowledgement.
- Genuinely uninitialized local persistence plus cloud documents: convert cloud records to `DraftSchema` and install them through `draftCoordinator`.
- Both sides populated: match by stable client ID, import non-colliding cloud-only records, upload local-only records, pull a newer server record only when the local version is unchanged, and mark uncertainty as conflict.
- Initialized but intentionally empty local collection: do not infer a new device from `drafts.length === 0` and do not resurrect unassociated cloud documents.
- Account switch: pause before reconciliation or upload.

Deleted cloud records are excluded from normal documents and returned as tombstones to the sync protocol. A tombstone retains ownership, stable client identity, revision, and deletion time while redacting title/content. Stale updates cannot match a `DELETED` lifecycle. No purge schedule is included in Phase 1; a future retention policy can remove old tombstones only after multi-device safety is designed.

## Development and CI

Set the existing server-only variables in `.env`, then run:

```text
npm run db:generate
npm run db:validate
npx prisma migrate dev
npm run test:db
```

Never reset the development database. CI starts an ephemeral PostgreSQL 17 service, applies committed migrations with `prisma migrate deploy`, runs Jest, and then runs the real database integration runner. CI does not use personal Neon credentials and contains no production test-auth bypass.

Lyric content is sent only to the authenticated Rhyme Lines API and PostgreSQL. This feature adds no content analytics, third-party content provider, object storage, version snapshots, collaboration, public sharing, WebSockets, or CRDTs.
