import { AccountDeletionError, normalizeAccountEmail, validateCaseId } from './admin-delete-account-core'

export type AdminDeleteAccountOptions =
  | { email: string; caseId: string; mode: 'dry-run' }
  | { email: string; caseId: string; mode: 'execute'; userId: string; confirmation: string }

export const adminDeleteAccountUsage = `Usage:
  npm run admin:delete-account -- --email <email> --case-id <case-id> [--dry-run]
  npm run admin:delete-account -- --email <email> --case-id <case-id> --user-id <id> --confirmation <artifact> --execute

Dry-run is the default. Requires ACCOUNT_DELETION_DATABASE_URL,
ACCOUNT_DELETION_CONFIRMATION_SECRET, and AUTH_SECRET in the operator environment.`

export function parseAdminDeleteAccountOptions(args: string[]): AdminDeleteAccountOptions {
  const values = new Map<string, string>()
  let dryRun = false
  let execute = false
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]
    if (option === '--dry-run') {
      if (dryRun) throw new AccountDeletionError('invalid-input')
      dryRun = true
      continue
    }
    if (option === '--execute') {
      if (execute) throw new AccountDeletionError('invalid-input')
      execute = true
      continue
    }
    if (!['--email', '--case-id', '--user-id', '--confirmation'].includes(option) || values.has(option)) {
      throw new AccountDeletionError('invalid-input')
    }
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new AccountDeletionError('invalid-input')
    values.set(option, value)
    index += 1
  }
  if (dryRun && execute) throw new AccountDeletionError('invalid-input')
  const email = values.get('--email')
  const caseId = values.get('--case-id')
  if (!email || !caseId || !validateCaseId(caseId)) throw new AccountDeletionError('invalid-input')
  const mode = execute ? 'execute' : 'dry-run'
  const userId = values.get('--user-id')
  const confirmation = values.get('--confirmation')
  if (mode === 'execute') {
    if (!userId || !confirmation) throw new AccountDeletionError('invalid-input')
    return { email: normalizeAccountEmail(email), caseId, mode, userId, confirmation }
  }
  if (userId || confirmation) throw new AccountDeletionError('invalid-input')
  return { email: normalizeAccountEmail(email), caseId, mode }
}
