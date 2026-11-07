import {
  createConfirmationArtifact,
  formatAccountDeletionError,
  getDatabaseIdentity,
  validateAccountDeletionSecret,
  validateCaseId,
  verifyConfirmationArtifact,
} from '../scripts/admin-delete-account-core'
import { parseAdminDeleteAccountOptions } from '../scripts/admin-delete-account-args'

const confirmationSecret = 'test-only-account-deletion-secret-000000000000'
const details = {
  databaseIdentity: 'a'.repeat(64),
  caseId: 'case-2042-07',
  userId: 'user-test-17',
  email: 'writer@example.test',
  scopeFingerprint: 'b'.repeat(64),
}

describe('administrator account deletion safeguards', () => {
  it('requires a non-identifying case reference and a separate strong confirmation secret', () => {
    expect(validateCaseId('case-2042-07')).toBe(true)
    expect(validateCaseId('writer@example.test')).toBe(false)
    expect(validateCaseId('../case')).toBe(false)
    expect(validateAccountDeletionSecret(confirmationSecret)).toBe(true)
    expect(validateAccountDeletionSecret('short')).toBe(false)
  })

  it('defaults to dry-run and requires deliberate execution parameters', () => {
    expect(parseAdminDeleteAccountOptions(['--email', ' Writer@Example.Test ', '--case-id', 'case-2042-07']))
      .toEqual({ email: 'writer@example.test', caseId: 'case-2042-07', mode: 'dry-run' })
    expect(() => parseAdminDeleteAccountOptions([
      '--email', 'writer@example.test', '--case-id', 'case-2042-07', '--execute',
    ])).toThrow()
    expect(() => parseAdminDeleteAccountOptions([
      '--email', 'writer@example.test', '--case-id', 'case-2042-07',
      '--user-id', 'user-test-17', '--confirmation', 'v1.artifact', '--execute',
    ])).not.toThrow()
    expect(() => parseAdminDeleteAccountOptions([
      '--email', 'writer@example.test', '--case-id', 'case-2042-07',
      '--user-id', 'user-test-17', '--confirmation', 'v1.artifact',
    ])).toThrow()
    expect(() => parseAdminDeleteAccountOptions([
      '--email', 'writer@example.test', '--case-id', 'case-2042-07', '--dry-run', '--execute',
    ])).toThrow()
  })

  it('binds confirmation to the account, case, database, and reviewed scope', () => {
    const artifact = createConfirmationArtifact(details, confirmationSecret)
    const identity = {
      databaseIdentity: details.databaseIdentity,
      caseId: details.caseId,
      userId: details.userId,
      email: details.email,
    }
    expect(verifyConfirmationArtifact(artifact, identity, confirmationSecret)).toBe(true)
    expect(verifyConfirmationArtifact(artifact, { ...identity, caseId: 'case-other' }, confirmationSecret)).toBe(false)
    expect(verifyConfirmationArtifact(artifact, { ...identity, userId: 'user-other' }, confirmationSecret)).toBe(false)
    expect(verifyConfirmationArtifact(artifact, { ...identity, email: 'other@example.test' }, confirmationSecret)).toBe(false)
    expect(verifyConfirmationArtifact(artifact, { ...identity, databaseIdentity: 'c'.repeat(64) }, confirmationSecret)).toBe(false)
    const changedScope = artifact.replace(/^v1\.[a-f0-9]{64}/, `v1.${'c'.repeat(64)}`)
    expect(verifyConfirmationArtifact(changedScope, identity, confirmationSecret)).toBe(false)
    const alteredMac = artifact.replace(/\.([A-Za-z0-9_-]{43})$/, (_match, mac: string) =>
      `.${mac[0] === 'A' ? 'B' : 'A'}${mac.slice(1)}`)
    expect(verifyConfirmationArtifact(alteredMac, identity, confirmationSecret)).toBe(false)
    expect(() => verifyConfirmationArtifact('forged', identity, confirmationSecret)).toThrow()
  })

  it('creates a database fingerprint without exposing connection credentials', () => {
    const first = getDatabaseIdentity('postgresql://alice:secret@localhost:5432/rhyme_test?sslmode=disable')
    const sameEndpoint = getDatabaseIdentity('postgresql://other:password@localhost:5432/rhyme_test?sslmode=disable')
    const otherDatabase = getDatabaseIdentity('postgresql://alice:secret@localhost:5432/another_test?sslmode=disable')
    expect(first).toHaveLength(64)
    expect(first).toBe(sameEndpoint)
    expect(first).not.toBe(otherDatabase)
    expect(first).not.toContain('secret')
  })

  it('sanitizes unexpected database errors rather than echoing their messages', () => {
    expect(formatAccountDeletionError(new Error('database password and SQL details')))
      .not.toContain('database password')
    expect(formatAccountDeletionError(new Error('database password and SQL details')))
      .toBe('Operation failed; no database details were logged.')
  })
})
