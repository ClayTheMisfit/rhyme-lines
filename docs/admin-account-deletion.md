# Administrator account deletion runbook

This is an internal, operator-run process. There is no public account-deletion endpoint. Do not use the tool until the requester has passed the identity checks below. Never use an account's presence or absence, its email sender address alone, or possession of a password/reset link as proof of ownership.

## Intake and identity verification

1. Receive the request at `support@rhymelines.net`. Acknowledge it manually; this workflow does not send support email automatically.
2. Assign a non-identifying case ID, such as `CASE-2026-0042`. Do not put an email, name, or document title in the case ID.
3. Keep the case record outside source control and record only the minimum required operational metadata.
4. Verify control of the registered mailbox with a fresh, one-time challenge sent manually to the address on the account and returned by the requester. Do not treat the original sender address as sufficient. Alternatively, where available, verify the request through an already authenticated account session plus the same independent case challenge.
5. Pause requests that are disputed, ambiguous, or cannot be tied to one account. If the requester has lost access to the registered mailbox, escalate for manual review and require an independently convincing ownership signal. Do not ask for passwords, authentication tokens, reset links, recovery codes, or government identity documents by default. If ownership cannot be established safely, do not delete the account.
6. Record the verification outcome and the case ID, not the challenge itself or unnecessary copies of correspondence.

## Environment and dry run

Use an approved operator workstation and a protected shell. Load these values from the organization-approved secret store; never put secrets in command arguments, this repository, or a case record:

- `ACCOUNT_DELETION_DATABASE_URL`: explicit PostgreSQL connection URL for the intended environment. The utility does not fall back to `DATABASE_URL`.
- `ACCOUNT_DELETION_CONFIRMATION_SECRET`: dedicated random secret of at least 32 bytes, available to the authorized operator only.
- `AUTH_SECRET`: the application's current authentication secret, used only to identify the account's email-keyed rate-limit rows. It is never printed.

Keep the URL, secrets, and terminal output private. Confirm the intended environment and database through the approved database inventory before running a command. The displayed database fingerprint identifies the URL's host, port, database name, and query options without displaying credentials.

```powershell
npm run admin:delete-account -- --email "<registered-email>" --case-id "CASE-2026-0042" --dry-run
```

Dry-run is also the default when `--dry-run` is omitted. It performs read-only queries in a repeatable-read transaction. Review the displayed database fingerprint, case ID, immutable user ID, and aggregate counts. No email address, lyrics, document title/content, password hash, token, session cookie, OAuth token, or database URL is displayed. The confirmation artifact is an HMAC authenticated with the dedicated operator secret and binds the account, case, database endpoint identity, and current set of database records in scope.

Do not record the confirmation artifact in the permanent case log. Keep it only in the protected working session for the paired execution. If any count or record changes, the execution fails closed and a fresh dry run is required.

## Authorized execution

After review, use the exact user ID and confirmation artifact returned by the dry run for the same case and database. Do not substitute an email address or user ID from another request.

```powershell
npm run admin:delete-account -- --email "<registered-email>" --case-id "CASE-2026-0042" --user-id "<reviewed-user-id>" --confirmation "<dry-run-artifact>" --execute
```

Execution requires `--execute`, the reviewed user ID, case ID, email, and valid confirmation artifact. The operation locks the user row, rechecks the approved scope, and deletes the related rows in one serializable transaction. Before commit it verifies zero remaining rows for the user and all attributable email-keyed records. On a stale scope, identity mismatch, concurrency conflict, database error, or unexpected constraint, it reports failure without logging database details; database atomicity prevents partial commits. If the connection fails during commit and the outcome is uncertain, perform read-only post-state verification before deciding whether to rerun.

## Post-operation verification

1. Confirm the tool reports `Account deletion committed` and the aggregate counts. A no-op result means the reviewed account was already absent; it is not evidence that a different account was processed.
2. In the approved database's read-only verification session, confirm zero rows remain for the user ID. For example, with the reviewed ID substituted only in the protected session:

   ```sql
   SELECT 'User' AS table_name, COUNT(*) FROM "User" WHERE id = '<reviewed-user-id>'
   UNION ALL SELECT 'Credential', COUNT(*) FROM "Credential" WHERE "userId" = '<reviewed-user-id>'
   UNION ALL SELECT 'Account', COUNT(*) FROM "Account" WHERE "userId" = '<reviewed-user-id>'
   UNION ALL SELECT 'Session', COUNT(*) FROM "Session" WHERE "userId" = '<reviewed-user-id>'
   UNION ALL SELECT 'AuthToken', COUNT(*) FROM "AuthToken" WHERE "userId" = '<reviewed-user-id>'
   UNION ALL SELECT 'CloudDocument', COUNT(*) FROM "CloudDocument" WHERE "userId" = '<reviewed-user-id>'
   UNION ALL SELECT 'CloudDocumentVersion', COUNT(*) FROM "CloudDocumentVersion" WHERE "userId" = '<reviewed-user-id>';
   ```

   The command's successful in-transaction verification covers the legacy `VerificationToken` and email-keyed `AuthRateLimit` records. Do not copy query results containing identifiers into the case record.
3. Record only the case ID, timestamp, operation result, operator role, and aggregate counts. Avoid retaining the account email, user-provided content, credential/token values, or database connection information.
4. Send a completion response manually to the verified requester. Do not send it until database verification is complete.

## Records and deletion boundaries

The utility explicitly removes the user's password credential, linked Auth.js accounts (including any locally stored OAuth provider tokens), database sessions, application authentication tokens, cloud documents, and cloud-document versions, then deletes the user. Database foreign-key cascades remain a final integrity safeguard. It removes legacy Auth.js verification-token rows whose identifier matches the account email case-insensitively and only the email-keyed rate-limit rows derivable from the current `AUTH_SECRET` (`login`, `password-reset`, and `verification-resend`). It preserves IP-keyed and unrelated rate-limit rows. Rows keyed with a previous authentication secret cannot safely be attributed and are left to existing cleanup. Rows whose ownership cannot be safely attributed are not deleted.

Deleting the local OAuth account link does not revoke a provider-side grant; the user may need to revoke that separately with the provider. Browser-local drafts, local settings, and other data stored on each device cannot be remotely erased by deleting cloud records and may need to be removed separately. Provider-managed logs and backups, and database backups, can remain subject to the applicable providers' retention and deletion processes. Database deletion does not guarantee immediate removal from every external backup. No provider retention interval or legal response deadline is promised by this runbook.

## Failure and escalation handling

- **Database connection failure:** no deletion is reported. Check the approved connection path and database health without copying connection details into logs; then rerun the dry run.
- **Account not found:** do not guess another email or user ID. Check the verified request and escalate if needed.
- **Incorrect user ID or case:** stop and compare with the recorded review. Do not weaken the confirmation checks.
- **Stale confirmation or changed scope:** discard the artifact, investigate unexpected record changes, review the new aggregate preview, and obtain approval again.
- **Concurrent update, transaction failure, or constraint error:** the transaction is atomic and cannot partially commit. If the connection fails during commit, verify the post-state using the reviewed user ID before retrying. Do not report completion until the outcome is known. Investigate the mismatch/constraint and rerun a fresh dry run after the condition is understood.
- **Duplicate request:** search the minimal case log. If the same account has already been deleted, confirm the verified case and report the safe no-op; do not reuse the deletion command for another user.
- **Unexpected relationships:** stop. Do not manually delete records or disable constraints. Review the schema and foreign keys, update the utility/tests/runbook through normal code review, and resume only after the scope is understood.

## Isolated integration tests

The PostgreSQL integration test is intentionally restricted to a loopback host and a database name containing `test`. It requires `ACCOUNT_DELETION_TEST_DATABASE_URL` and will not use `DATABASE_URL`:

```powershell
npm run test:admin-delete-account-db
```

Use only a disposable local PostgreSQL test database. Never point this variable or any test command at Production or real user data.
