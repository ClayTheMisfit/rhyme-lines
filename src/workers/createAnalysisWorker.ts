export function createAnalysisWorker(): Worker {
  return new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
}
