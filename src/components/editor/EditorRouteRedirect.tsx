'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getLastOpenProjectId } from '@/lib/projects/storage'
import { useAppStateHydration } from '@/hooks/useAppStateHydration'
import { useTabsStore } from '@/store/tabsStore'

export function EditorRouteRedirect() {
  const router = useRouter()
  const { state: hydrationState, draftsStatus } = useAppStateHydration()
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)

  useEffect(() => {
    if (hydrationState !== 'ready') return
    const lastProjectId = getLastOpenProjectId()
    if (lastProjectId && tabs.some((tab) => tab.id === lastProjectId)) {
      router.replace(`/editor/${lastProjectId}`)
      return
    }
    if (draftsStatus === 'ok' && tabs.some((tab) => tab.id === activeTabId)) {
      router.replace(`/editor/${activeTabId}`)
      return
    }
    router.replace('/')
  }, [activeTabId, draftsStatus, hydrationState, router, tabs])

  return <div className="min-h-screen bg-black" aria-busy={hydrationState === 'pending'} aria-hidden />
}
