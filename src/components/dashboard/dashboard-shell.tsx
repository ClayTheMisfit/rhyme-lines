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
  assignProjectFolder,
  createFolder,
  createProject,
  filterProjectSummaries,
  getProjectCounts,
  getLastOpenProjectId,
  listActiveProjectSummaries,
  listArchivedProjectSummaries,
  listFolders,
  listTrashProjectSummaries,
  moveProjectToTrash,
  permanentlyDeleteProject,
  renameProject,
  restoreProject,
  restoreProjectFromTrash,
  setLastOpenProjectId,
  type ProjectFolder,
  type ProjectSummary,
} from '@/lib/projects/storage'

export function DashboardShell() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [activeProjectCount, setActiveProjectCount] = useState(0)
  const [latestProject, setLatestProject] = useState<ProjectSummary | null>(null)
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [counts, setCounts] = useState({ archived: 0, trash: 0 })
  const [view, setView] = useState<'projects' | 'archived' | 'trash'>('projects')
  const [search, setSearch] = useState('')
  const [folderFilter, setFolderFilter] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showOrganizeControls, setShowOrganizeControls] = useState(false)

  const reloadProjects = useCallback(() => {
    const activeRows = listActiveProjectSummaries()
    const baseRows =
      view === 'archived'
        ? listArchivedProjectSummaries()
        : view === 'trash'
          ? listTrashProjectSummaries()
          : activeRows
    const allFolders = listFolders()
    const lastOpenProjectId = getLastOpenProjectId()
    const lastOpenProject = activeRows.find((project) => project.id === lastOpenProjectId)
    setActiveProjectCount(activeRows.length)
    setLatestProject(lastOpenProject ?? activeRows[0] ?? null)
    setFolders(allFolders)
    setCounts(getProjectCounts())
    setProjects(filterProjectSummaries(baseRows, search, folderFilter, allFolders))
  }, [folderFilter, search, view])

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

  const handleOpenProject = useCallback(
    (id: string) => {
      setLastOpenProjectId(id)
      router.push(`/editor/${id}`)
    },
    [router]
  )

  const handleDeleteProject = useCallback(
    (id: string) => {
      moveProjectToTrash(id)
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

  const handleRestoreFromTrash = useCallback(
    (id: string) => {
      restoreProjectFromTrash(id)
      reloadProjects()
    },
    [reloadProjects]
  )

  const handleDeletePermanently = useCallback(
    (id: string) => {
      const shouldDelete = window.confirm('Delete this project permanently? This cannot be undone.')
      if (!shouldDelete) return
      permanentlyDeleteProject(id)
      reloadProjects()
    },
    [reloadProjects]
  )

  const handleRenameProject = useCallback(
    (id: string, title: string) => {
      renameProject(id, title)
      reloadProjects()
    },
    [reloadProjects]
  )

  const handleCreateFolder = useCallback(() => {
    const created = createFolder(newFolderName)
    if (!created) return
    setNewFolderName('')
    reloadProjects()
  }, [newFolderName, reloadProjects])

  const handleAssignFolder = useCallback(
    (id: string, folderId: string | null) => {
      assignProjectFolder(id, folderId)
      reloadProjects()
    },
    [reloadProjects]
  )

  return (
    <div className="dashboard-page min-h-screen bg-[#090909] text-white">
      <DashboardTopbar
        view={view}
        onViewChange={setView}
        archivedCount={counts.archived}
        trashCount={counts.trash}
        search={search}
        onSearchChange={setSearch}
      />
      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)]">
        <DashboardSidebar />

        <main className="flex min-w-0 flex-col border-l border-white/[0.028] px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
          <DashboardHero
            projectCount={activeProjectCount}
            onCreateProject={handleCreateProject}
            latestProject={latestProject}
            onResumeProject={handleOpenProject}
          />

          {view === 'projects' ? (
            <section className="mt-6 border-b border-white/[0.05] pb-5">
              <button
                type="button"
                onClick={() => setShowOrganizeControls((current) => !current)}
                aria-expanded={showOrganizeControls}
                className="inline-flex h-8 items-center rounded border border-white/[0.09] px-3 text-[11px] tracking-[0.1em] text-white/58 transition-colors hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111214]"
              >
                {showOrganizeControls ? 'HIDE ORGANIZE TOOLS' : 'ORGANIZE PROJECTS'}
              </button>

              {showOrganizeControls ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="text-xs tracking-[0.12em] text-white/40" htmlFor="dashboard-folder-filter">
                    Folder
                  </label>
                  <select
                    id="dashboard-folder-filter"
                    value={folderFilter ?? ''}
                    onChange={(event) => setFolderFilter(event.target.value || null)}
                    className="h-9 min-w-[170px] border border-white/[0.08] bg-[#161618] px-3 text-xs text-white/70 focus:outline-none"
                  >
                    <option value="">All folders</option>
                    <option value="__none__">No folder</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleCreateFolder()
                    }}
                    placeholder="New folder"
                    className="h-9 min-w-[170px] border border-white/[0.08] bg-[#161618] px-3 text-xs text-white/70 placeholder:text-white/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateFolder}
                    className="h-9 border border-white/[0.12] px-3 text-[11px] tracking-[0.1em] text-white/74 hover:bg-white/[0.05]"
                  >
                    CREATE FOLDER
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="mt-10 min-w-0">
            <ManuscriptList
              rows={projects}
              view={view}
              search={search}
              folders={folders}
              onArchive={handleArchiveProject}
              onRestore={handleRestoreProject}
              onRestoreFromTrash={handleRestoreFromTrash}
              onRename={handleRenameProject}
              onAssignFolder={handleAssignFolder}
              onDeletePermanently={handleDeletePermanently}
              onDelete={handleDeleteProject}
            />
          </section>

          <DashboardFooter />
        </main>
      </div>
    </div>
  )
}
