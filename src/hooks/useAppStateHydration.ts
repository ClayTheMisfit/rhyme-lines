'use client'

import { useEffect, useState } from 'react'
import { loadPersistedAppState } from '@/lib/persist/appState'
import type { PersistenceLoadStatus } from '@/lib/persist/migrations'
import { createDefaultDraftCollection } from '@/lib/persist/schema'
import { hydrateBadgeSettings } from '@/store/settings'
import { hydrateRhymePanel } from '@/store/rhymePanelStore'
import { hydrateSettingsStore } from '@/store/settingsStore'
import { hydrateTabsFromPersisted } from '@/store/tabsStore'

export type AppStateHydrationState = 'pending' | 'ready' | 'degraded'
export type AppStateHydrationResult = {
  state: AppStateHydrationState
  draftsStatus: PersistenceLoadStatus | null
}

export async function hydratePersistedAppState(): Promise<AppStateHydrationResult> {
  try {
    const snapshot = loadPersistedAppState()
    const draftsReady = snapshot.hydration.drafts === 'ok' || snapshot.hydration.drafts === 'missing'

    hydrateSettingsStore(snapshot.settings)
    hydrateTabsFromPersisted(snapshot.drafts, {
      allowPersistence: draftsReady,
      alreadyPersisted: snapshot.hydration.drafts === 'ok',
    })
    hydrateRhymePanel(snapshot.panel)
    hydrateBadgeSettings()

    return {
      state: draftsReady ? 'ready' : 'degraded',
      draftsStatus: snapshot.hydration.drafts,
    }
  } catch {
    hydrateTabsFromPersisted(createDefaultDraftCollection(), { allowPersistence: false })
    return { state: 'degraded', draftsStatus: 'unavailable' }
  }
}

export function useAppStateHydration(): AppStateHydrationResult {
  const [result, setResult] = useState<AppStateHydrationResult>({
    state: 'pending',
    draftsStatus: null,
  })

  useEffect(() => {
    let cancelled = false
    // Defer work one microtask so a Strict Mode probe can cancel before touching persisted state.
    void Promise.resolve()
      .then(() => (cancelled ? null : hydratePersistedAppState()))
      .then((nextResult) => {
        if (!cancelled && nextResult) setResult(nextResult)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return result
}
