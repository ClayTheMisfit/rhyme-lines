'use client'

import { useEffect } from 'react'
import { useRhymeHighlightSettingsStore } from '@/store/rhymeHighlightSettingsStore'

export default function RhymeHighlightSettingsHydrator() {
  const hydrate = useRhymeHighlightSettingsStore((state) => state.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return null
}
