'use client'

import { useCallback, useEffect, useRef } from 'react'

const DEFAULT_DEBOUNCE_MS = 200

export function useRhymeRecomputeScheduler(debounceMs = DEFAULT_DEBOUNCE_MS) {
  const timerRef = useRef<number | null>(null)

  const requestRecompute = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      window.dispatchEvent(new CustomEvent('rhyme:recompute'))
    }, debounceMs)
  }, [debounceMs])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return { requestRecompute }
}
