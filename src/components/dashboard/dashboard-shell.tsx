'use client'

import { useCallback, useEffect, useState } from 'react'
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
  listActiveProjectSummaries,
  listArchivedProjectSummaries,
  restoreProject,
  setLastOpenProjectId,
  type ProjectSummary,
} from '@/lib/projects/storage'

export function DashboardShell() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [view, setView] = useState<'projects' | 'archived'>('projects')

  const reloadProjects = useCallback(() => {
    setProjects(view === 'archived' ? listArchivedProjectSummaries() : listActiveProjectSummaries())
  }, [view])

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

  const handleDeleteProject = useCallback(
    (id: string) => {
      deleteProject(id)
      reloadProjects()
    },
    [reloadProjects]
  )

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

  return (
    <div className="dashboard-page min-h-screen bg-[#090909] text-white">
      <DashboardTopbar view={view} onViewChange={setView} />
      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)]">
        <DashboardSidebar />

        <main className="flex min-w-0 flex-col border-l border-white/[0.028] px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
          <DashboardHero projectCount={projects.length} onCreateProject={handleCreateProject} />

          <section className="mt-10 min-w-0">
            <ManuscriptList
              rows={projects}
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
