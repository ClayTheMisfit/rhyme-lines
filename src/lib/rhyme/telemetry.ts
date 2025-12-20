export interface RhymeTelemetrySnapshot {
  requests: number
  cacheHits: number
  errors: number
  lastLatencyMs: number[]
}

const telemetry: RhymeTelemetrySnapshot = {
  requests: 0,
  cacheHits: 0,
  errors: 0,
  lastLatencyMs: [],
}

export function trackRequest(latencyMs: number) {
  telemetry.requests += 1
  telemetry.lastLatencyMs = [...telemetry.lastLatencyMs.slice(-4), latencyMs]
}

export function trackCacheHit() {
  telemetry.cacheHits += 1
}

export function trackError() {
  telemetry.errors += 1
}

export function getTelemetry(): RhymeTelemetrySnapshot {
  return { ...telemetry, lastLatencyMs: [...telemetry.lastLatencyMs] }
}
