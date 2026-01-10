import { createRhymeWorkerClient } from '@/lib/rhyme-db/rhymeWorkerClient'

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
    initPromise = getRhymeClient().init()
  }
  return initPromise
}
