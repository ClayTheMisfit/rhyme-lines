export function createRhymeWorker(): Worker {
  return new Worker(new URL('./rhyme.worker.ts', import.meta.url), { type: 'module' })
}
