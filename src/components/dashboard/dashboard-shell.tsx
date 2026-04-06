'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardTopbar } from './dashboard-topbar'
import { DashboardSidebar } from './dashboard-sidebar'
import { DashboardHero } from './dashboard-hero'
import { ManuscriptList } from './manuscript-list'
import { DashboardFooter } from './dashboard-footer'
import {
  archiveProject,
  createProject,
  deleteProject,
  listProjectSummaries,
  restoreProject,
  setLastOpenProjectId,
  type ProjectSummary,
} from '@/lib/projects/storage'

type DashboardView = 'active' | 'archived'

export function DashboardShell() {
  const router = useRouter()
  const [view, setView] = useState<DashboardView>('active')
  const [activeProjects, setActiveProjects] = useState<ProjectSummary[]>([])
  const [archivedProjects, setArchivedProjects] = useState<ProjectSummary[]>([])

  const reloadProjects = useCallback(() => {
    setActiveProjects(listProjectSummaries('active'))
    setArchivedProjects(listProjectSummaries('archived'))
  }, [])

  useEffect(() => {
    reloadProjects()
    const handleStorage = () => reloadProjects()
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [reloadProjects])

  const handleCreateProject = useCallback(() => {
    const project = createProject('Untitled')
    setLastOpenProjectId(project.id)
    router.push(`/editor/${project.id}`)
  }, [router])

  const handleArchiveProject = useCallback(
    (id: string) => {
      archiveProject(id)
      reloadProjects()
    },
    [reloadProjects]
  )

  const handleRestoreProject = useCallback(
    (id: string) => {
      restoreProject(id)
      reloadProjects()
    },
    [reloadProjects]
  )

  const handleDeleteProject = useCallback(
    (id: string) => {
      deleteProject(id)
      reloadProjects()
    },
    [reloadProjects]
  )

  const visibleProjects = useMemo(
    () => (view === 'active' ? activeProjects : archivedProjects),
    [activeProjects, archivedProjects, view]
  )

  return (
    <div className="dashboard-page min-h-screen bg-[#090909] text-white">
      <DashboardTopbar activeView={view} onViewChange={setView} />
      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)]">
        <DashboardSidebar />

        <main className="flex min-w-0 flex-col border-l border-white/[0.028] px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
          <DashboardHero projectCount={activeProjects.length} onCreateProject={handleCreateProject} />

          <section className="mt-10 min-w-0">
            <ManuscriptList
              rows={visibleProjects}
              view={view}
              onArchive={handleArchiveProject}
              onRestore={handleRestoreProject}
              onDelete={handleDeleteProject}
            />
          </section>

          <DashboardFooter />
        </main>
      </div>
    </div>
  )
}
