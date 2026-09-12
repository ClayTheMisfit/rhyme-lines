import { createRhymeWorkerClientForWorker } from '@/lib/rhyme-db/rhymeWorkerClientCore'

export {
  RhymeWorkerError,
  RHYME_WORKER_INIT_TIMEOUT_MS,
  RHYME_WORKER_QUERY_TIMEOUT_MS,
} from '@/lib/rhyme-db/rhymeWorkerClientCore'

export const createRhymeWorkerClient = () =>
  createRhymeWorkerClientForWorker(
    new Worker(new URL('../../workers/rhymeWorker.ts', import.meta.url), { type: 'module' })
  )
