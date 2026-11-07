import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { adminDeleteAccountUsage, parseAdminDeleteAccountOptions } from './admin-delete-account-args'
import {
  AccountDeletionError,
  executeAccountDeletion,
  formatAccountDeletionError,
  getDatabaseIdentity,
  previewAccountDeletion,
  validateAccountDeletionSecret,
} from './admin-delete-account-core'

function printCounts(counts: {
  user: number
  credential: number
  authAccounts: number
  sessions: number
  authTokens: number
  cloudDocuments: number
  cloudDocumentVersions: number
  legacyVerificationTokens: number
  emailRateLimits: number
}) {
  console.log(`  User records: ${counts.user}`)
  console.log(`  Password credentials: ${counts.credential}`)
  console.log(`  Linked authentication accounts: ${counts.authAccounts}`)
  console.log(`  Database sessions: ${counts.sessions}`)
  console.log(`  Authentication tokens: ${counts.authTokens}`)
  console.log(`  Cloud documents: ${counts.cloudDocuments}`)
  console.log(`  Document versions: ${counts.cloudDocumentVersions}`)
  console.log(`  Legacy email verification tokens: ${counts.legacyVerificationTokens}`)
  console.log(`  Email-keyed rate limits: ${counts.emailRateLimits}`)
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    console.log(adminDeleteAccountUsage)
    return
  }
  const options = parseAdminDeleteAccountOptions(process.argv.slice(2))
  const databaseUrl = process.env.ACCOUNT_DELETION_DATABASE_URL
  const confirmationSecret = process.env.ACCOUNT_DELETION_CONFIRMATION_SECRET
  const authSecret = process.env.AUTH_SECRET
  if (!databaseUrl || !confirmationSecret || !authSecret
    || !validateAccountDeletionSecret(confirmationSecret)
    || !validateAccountDeletionSecret(authSecret)) {
    throw new AccountDeletionError('invalid-input')
  }
  const databaseIdentity = getDatabaseIdentity(databaseUrl)
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 }),
  })
  let deletionCommitted = false
  try {
    if (options.mode === 'dry-run') {
      const preview = await previewAccountDeletion(database, {
        email: options.email,
        caseId: options.caseId,
        confirmationSecret,
        databaseIdentity,
        authSecret,
      })
      console.log('Mode: dry run (no database writes)')
      console.log(`Database fingerprint: ${databaseIdentity}`)
      console.log(`Case ID: ${options.caseId}`)
      console.log(`User ID: ${preview.userId}`)
      console.log('Aggregate records in deletion scope:')
      printCounts(preview.counts)
      console.log(`Confirmation artifact: ${preview.confirmation}`)
      return
    }

    if (options.mode !== 'execute') throw new AccountDeletionError('invalid-input')
    const result = await executeAccountDeletion(database, {
      ...options,
      confirmationSecret,
      databaseIdentity,
      authSecret,
    })
    if (result.status === 'already-deleted') {
      console.log('Account was already absent; no rows changed.')
      return
    }
    deletionCommitted = true
    console.log('Account deletion committed.')
    printCounts(result.counts)
  } finally {
    try {
      await database.$disconnect()
    } catch {
      console.error(deletionCommitted
        ? 'Account deletion committed, but database client shutdown failed.'
        : 'Database client shutdown failed.')
      process.exitCode = 1
    }
  }
}

main().catch((error: unknown) => {
  console.error(formatAccountDeletionError(error))
  process.exitCode = 1
})
