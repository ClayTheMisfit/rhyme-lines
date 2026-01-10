'use client'

import { useEffect } from 'react'
import { initRhymeClient } from '@/lib/rhyme-db/rhymeClientSingleton'

export default function RhymeWorkerBootstrap() {
  useEffect(() => {
    initRhymeClient().catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to initialize rhyme worker:', error)
      }
    })
  }, [])

  return null
}
