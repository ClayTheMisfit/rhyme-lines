import { createRhymeWorkerClient } from '@/lib/rhyme-db/rhymeWorkerClient'
import { markLocalInitFailed, markLocalInitReady } from '@/lib/rhymes/rhymeSource'

let client: ReturnType<typeof createRhymeWorkerClient> | null = null
let initPromise: Promise<void> | null = null

export const getRhymeClient = () => {
  if (!client) {
    client = createRhymeWorkerClient()
  }
  return client
}

export const initRhymeClient = () => {
  if (!initPromise) {
    initPromise = getRhymeClient()
      .init()
      .then(() => {
        markLocalInitReady()
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to initialize rhyme worker'
        markLocalInitFailed(message)
        throw error
      })
  }
  return initPromise
}
