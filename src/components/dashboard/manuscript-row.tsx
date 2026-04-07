import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ProjectFolder, ProjectSummary } from '@/lib/projects/storage'

type ManuscriptRowProps = {
  project: ProjectSummary
  view: 'projects' | 'archived' | 'trash'
  folders: ProjectFolder[]
  onRename?: (id: string, title: string) => void
  onAssignFolder?: (id: string, folderId: string | null) => void
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
  onRestoreFromTrash?: (id: string) => void
  onDeletePermanently?: (id: string) => void
  onDelete?: (id: string) => void
}

const formatUpdatedAt = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Unknown update time' : date.toLocaleString()
}

const actionClassName =
  'ml-2 rounded border border-white/[0.08] px-2 py-1 text-[10px] tracking-[0.1em] text-white/56 hover:text-white/86'

export function ManuscriptRow({
  project,
  view,
  folders,
  onRename,
  onAssignFolder,
  onArchive,
  onRestore,
  onRestoreFromTrash,
  onDeletePermanently,
  onDelete,
}: ManuscriptRowProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState(project.title)

  useEffect(() => {
    setDraftTitle(project.title)
  }, [project.title])

  const saveRename = () => {
    if (!isRenaming) return
    onRename?.(project.id, draftTitle)
    setIsRenaming(false)
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-white/[0.032] bg-[#18181a] px-4 py-4.5 sm:px-5 sm:py-5">
      <div className="min-w-0">
        {isRenaming ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={saveRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveRename()
              if (event.key === 'Escape') {
                setDraftTitle(project.title)
                setIsRenaming(false)
              }
            }}
            className="w-full border border-white/[0.12] bg-[#0f0f10] px-2 py-1 text-[15px] text-white/88 focus:outline-none"
          />
        ) : (
          <p className="truncate text-[15px] text-white/88">{project.title}</p>
        )}
        <p className="mt-1.5 truncate text-xs tracking-[0.02em] text-white/36">
          {project.preview || 'Empty draft'}
        </p>
        <p className="mt-1 text-[11px] tracking-[0.02em] text-white/28">
          {project.wordCount} words · {project.lineCount} lines · Updated {formatUpdatedAt(project.updatedAt)}
        </p>
        <p className="mt-1 text-[10px] tracking-[0.03em] text-white/26">
          Density {project.rhymeDensity.toFixed(2)} · Internal {project.internalRhymes} · Families{' '}
          {project.endRhymeFamilyCount} · Avg syllables {project.averageSyllablesPerLine.toFixed(1)}
        </p>
      </div>
      <div className="ml-2 flex items-center">
        {view !== 'trash' ? (
          <Link
            href={`/editor/${project.id}`}
            className={actionClassName}
            aria-label={`Open ${project.title}`}
          >
            Open
          </Link>
        ) : null}
        {view !== 'trash' ? (
          <>
            <button
              type="button"
              onClick={() => setIsRenaming(true)}
              className={actionClassName}
              aria-label={`Rename ${project.title}`}
            >
              Rename
            </button>
            <select
              value={project.folderId ?? ''}
              onChange={(event) => onAssignFolder?.(project.id, event.target.value || null)}
              className="ml-2 h-7 border border-white/[0.08] bg-[#101012] px-2 text-[10px] tracking-[0.08em] text-white/56"
              aria-label={`Move ${project.title} to folder`}
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {view === 'projects' && onArchive ? (
          <button
            type="button"
            onClick={() => onArchive(project.id)}
            className={actionClassName}
            aria-label={`Archive ${project.title}`}
          >
            Archive
          </button>
        ) : null}
        {view === 'archived' && onRestore ? (
          <button
            type="button"
            onClick={() => onRestore(project.id)}
            className={actionClassName}
            aria-label={`Restore ${project.title}`}
          >
            Restore
          </button>
        ) : null}
        {view === 'trash' && onRestoreFromTrash ? (
          <button
            type="button"
            onClick={() => onRestoreFromTrash(project.id)}
            className={actionClassName}
            aria-label={`Restore ${project.title}`}
          >
            Restore
          </button>
        ) : null}
        {view === 'trash' && onDeletePermanently ? (
          <button
            type="button"
            onClick={() => onDeletePermanently(project.id)}
            className={actionClassName}
            aria-label={`Delete ${project.title} permanently`}
          >
            Delete forever
          </button>
        ) : null}
        {view !== 'trash' && onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(project.id)}
            className="ml-2 mr-1 text-white/28 hover:text-white/56"
            aria-label={`Delete ${project.title}`}
          >
            ✕
          </button>
        ) : null}
      </div>
    </li>
  )
}
