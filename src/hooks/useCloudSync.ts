'use client'

import { useEffect } from 'react'
import type { AppStateHydrationResult } from '@/hooks/useAppStateHydration'
import { cloudSyncManager } from '@/lib/cloud-sync/client'

export function useCloudSync(hydration: AppStateHydrationResult) {
  const { state, draftsStatus } = hydration
  useEffect(() => {
    if (state === 'ready') cloudSyncManager.start(draftsStatus)
  }, [draftsStatus, state])
}
