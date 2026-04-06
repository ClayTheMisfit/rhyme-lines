'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getLastOpenProjectId } from '@/lib/projects/storage'

export function EditorRouteRedirect() {
  const router = useRouter()

  useEffect(() => {
    const lastProjectId = getLastOpenProjectId()
    if (lastProjectId) {
      router.replace(`/editor/${lastProjectId}`)
      return
    }
    router.replace('/')
  }, [router])

  return <div className="min-h-screen bg-black" aria-hidden />
}
