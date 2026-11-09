export function getSyntheticIpRateLimitIdentity(runId: string) {
  return `account-deletion-test:${runId}:192.0.2.77`
}
