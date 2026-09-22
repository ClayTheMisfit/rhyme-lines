# Conflict Resolution

Rhyme Lines enters `conflict` when the canonical local document and its owned cloud document have both changed, when an update receives HTTP 409, or when lifecycle state cannot be reconciled safely. Normal upload retries stop until the user resolves the conflict. Local editing and local persistence remain available.

## Persisted state

Conflict awareness is stored in `rhyme-lines:cloud-sync:v1` under the authenticated account and local document association. The record contains the local and cloud IDs already held by the association plus known revisions, a hashed local version marker, server and detection timestamps, a reason, and recovery-copy markers when needed. It does not contain lyric bodies, credentials, provider tokens, session tokens, or database credentials. Canonical local lyrics stay in draft persistence; cloud lyrics are fetched only for a temporary resolution session.

Signing out, changing accounts, or losing authentication clears the rendered cloud preview and disables resolution. Another account cannot fetch or mutate the original account's document because every route derives ownership from `getCurrentUser()`.

## User flow

`Cloud: Sync conflict · Resolve` and the conditional `Resolve Sync Conflict` command open a focused dialog without interrupting typing automatically. The dialog fetches the latest owned cloud document and shows simple read-only local and cloud previews, lifecycle states, revisions, and timestamps. Wide screens use two columns and narrow screens stack the previews. Escape and Cancel close without resolving; the Radix dialog traps focus and restores it on close.

The three whole-document actions are:

- **Keep Local** sends the current canonical local document with the displayed cloud revision to the dedicated resolution route. The server locks the owned document, rejects stale or deleted records, checkpoints the current authoritative cloud state, writes revision N+1, and checkpoints the result in one transaction. The existing `AUTO` history reason is reused to avoid a schema-only migration. A permanently deleted cloud identity cannot be resurrected; in that case, Keep Local preserves the candidate as a new independent local document.
- **Use Cloud** first creates and acknowledges `<Title> — Conflict Copy` (with a numeric collision suffix), then deliberately replaces the original through `draftCoordinator`. A cloud tombstone removes the original locally only after the recovery copy is durable.
- **Save Both** follows the same safe ordering: the original adopts or retains the current cloud state and the local candidate becomes a new document with the shared document-ID generator. The copy then follows normal cloud bootstrap. It is never bound to the original cloud record.

Recovery metadata makes retried Use Cloud and Save Both operations reuse the acknowledged copy. If copy creation fails, the original is untouched. If original replacement fails after the copy succeeds, the copy and conflict both remain visible.

## Freshness and races

Opening and refreshing the dialog fetches current server state. Every action then verifies the active account, exact canonical local candidate, and current server revision again. A changed local or server version disables or rejects the action, refreshes previews, and requires another explicit choice. No preview is trusted indefinitely.

Keep Local responses are applied to metadata only when the exact submitted local candidate is still current. If the user edits during the request, the accepted submitted revision remains on the server while the newer local edit remains conflicted. Use Cloud and Save Both also revalidate after recovery-copy persistence and before replacing the original.

Offline resolution is disabled with `Reconnect to resolve this conflict.` Authentication expiry and account changes preserve local content and conflict metadata while disabling action. Archive and trash state are displayed and treated as part of the whole-document choice. A `DELETED` tombstone always keeps its old cloud identity deleted.

## Privacy and performance

Conflict previews and errors are not logged or sent to analytics. Server errors use fixed public messages. Resolution logic does not run in editor input, caret, selection, analysis scheduling, or overlay rendering. Exact content comparisons happen only during user-triggered inspection and action; the active dialog listens only for a canonical collection identity change. There is no line diff, automatic merge, merge heuristic, CRDT, collaboration, sharing, or WebSocket behavior in Phase 1.

## Verification

Unit and integration coverage exercises persisted conflict reloads, all actions, recovery and partial failures, server and local staleness, edit-during-request races, offline/auth/account boundaries, tombstones, lifecycle disagreements, history, authorization, API validation, dialog accessibility, and keyboard behavior. The deterministic Playwright flow uses intercepted authenticated endpoints without adding a production authentication bypass. Database integration tests run against an isolated synthetic owner and verify atomic history/current-state behavior, stale replay, concurrent writers, ownership, and deletion privacy.
