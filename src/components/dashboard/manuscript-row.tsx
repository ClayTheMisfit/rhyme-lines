import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ProjectFolder, ProjectSummary } from '@/lib/projects/storage'

type ManuscriptRowProps = {
  project: ProjectSummary
  view: 'projects' | 'archived' | 'trash'
  folders: ProjectFolder[]
  isFeatured?: boolean
  onRename?: (id: string, title: string) => void
  onAssignFolder?: (id: string, folderId: string | null) => void
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
  onRestoreFromTrash?: (id: string) => void
  onDeletePermanently?: (id: string) => void
  onDelete?: (id: string) => void
  onOpen?: (id: string) => void
}

const formatUpdatedAt = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Unknown update time' : date.toLocaleString()
}

const actionClassName =
  'ml-2 cursor-pointer rounded-md px-2.5 py-1.5 text-[10px] tracking-[0.06em] text-white/62 transition-[background-color,color,border-color] duration-150 hover:bg-white/[0.06] hover:text-white/88 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111418] disabled:cursor-not-allowed'

export function ManuscriptRow({
  project,
  view,
  folders,
  isFeatured = false,
  onRename,
  onAssignFolder,
  onArchive,
  onRestore,
  onRestoreFromTrash,
  onDeletePermanently,
  onDelete,
  onOpen,
}: ManuscriptRowProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState(project.title)

  useEffect(() => {
    setDraftTitle(project.title)
  }, [project.title])

  const saveRename = () => {
    if (!isRenaming) return
    const trimmed = draftTitle.trim()
    if (trimmed) onRename?.(project.id, trimmed)
    setIsRenaming(false)
  }

  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-4 py-4.5 transition-[background-color,border-color,box-shadow,transform] duration-150 motion-reduce:transition-none focus-within:ring-2 focus-within:ring-[#d6b85d]/50 focus-within:ring-offset-2 focus-within:ring-offset-[#111418] sm:px-5 sm:py-5 ${
        isFeatured
          ? 'bg-[#1b222b] ring-1 ring-white/[0.08]'
          : 'bg-[#171c23] ring-1 ring-transparent hover:bg-[#1a2129] hover:ring-white/[0.08] hover:shadow-[0_8px_20px_rgba(0,0,0,0.18)]'
      }`}
    >
      <div className="min-w-0">
        {isFeatured && view === 'projects' ? (
          <p className="mb-1 text-[10px] tracking-[0.08em] text-[#e0c774]">Most recent draft</p>
        ) : null}
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
            className="w-full rounded-md border border-white/[0.12] bg-[#0f141b] px-2.5 py-1.5 text-[15px] text-white/90 transition-[border-color,box-shadow,background-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111418]"
          />
        ) : (
          <p className="truncate text-[15px] font-medium text-white/90">{project.title}</p>
        )}
        <p className="mt-1.5 truncate text-xs leading-relaxed tracking-[0.01em] text-white/56">
          {project.preview || 'Empty draft'}
        </p>
        <p className="mt-1.5 text-[11px] tracking-[0.01em] text-white/50">
          {project.wordCount} words · {project.lineCount} lines · Updated {formatUpdatedAt(project.updatedAt)}
          {project.folderName ? ` · ${project.folderName}` : ''}
        </p>
      </div>
      <div className="ml-2 flex items-center rounded-md bg-[#11161d] p-1">
        {view !== 'trash' ? (
          <Link
            href={`/editor/${project.id}`}
            onClick={() => onOpen?.(project.id)}
            className={actionClassName}
            aria-label={`Open ${project.title}`}
          >
            {isFeatured && view === 'projects' ? 'Resume' : 'Open'}
          </Link>
        ) : null}
        <details className="relative ml-2">
          <summary
            className="list-none cursor-pointer rounded-md px-2 py-1 text-sm text-white/44 transition-[background-color,color,border-color,box-shadow] duration-150 hover:bg-white/[0.06] hover:text-white/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111418] motion-reduce:transition-none"
            aria-label={`More actions for ${project.title}`}
          >
            ⋯
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-white/[0.09] bg-[#141a22] p-1.5 opacity-100 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none">
            {view !== 'trash' ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsRenaming(true)}
                  className="w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-xs text-white/78 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65"
                  aria-label={`Rename ${project.title}`}
                >
                  Rename
                </button>
                <label className="mt-1 block px-2.5 text-[10px] tracking-[0.04em] text-white/46" htmlFor={`folder-${project.id}`}>
                  Folder
                </label>
                <select
                  id={`folder-${project.id}`}
                  value={project.folderId ?? ''}
                  onChange={(event) => onAssignFolder?.(project.id, event.target.value || null)}
                  className="mt-1 h-7 w-full cursor-pointer rounded border border-white/[0.08] bg-[#121820] px-2 text-[10px] tracking-[0.04em] text-white/62 transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-white/[0.16] hover:bg-[#182130] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65 motion-reduce:transition-none"
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
                className="mt-1 w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-xs text-white/78 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65"
                aria-label={`Archive ${project.title}`}
              >
                Archive
              </button>
            ) : null}

            {view === 'archived' && onRestore ? (
              <button
                type="button"
                onClick={() => onRestore(project.id)}
                className="mt-1 w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-xs text-white/78 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65"
                aria-label={`Restore ${project.title}`}
              >
                Restore
              </button>
            ) : null}

            {view === 'trash' && onRestoreFromTrash ? (
              <button
                type="button"
                onClick={() => onRestoreFromTrash(project.id)}
                className="w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-xs text-white/78 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65"
                aria-label={`Restore ${project.title}`}
              >
                Restore
              </button>
            ) : null}

            {view === 'trash' && onDeletePermanently ? (
              <button
                type="button"
                onClick={() => onDeletePermanently(project.id)}
                className="mt-1 w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-xs text-white/78 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65"
                aria-label={`Delete ${project.title} permanently`}
              >
                Delete forever
              </button>
            ) : null}

            {view !== 'trash' && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(project.id)}
                className="mt-1 w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-xs text-white/68 transition-colors hover:bg-[#40282b] hover:text-white/84 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65"
                aria-label={`Delete ${project.title}`}
              >
                Move to trash
              </button>
            ) : null}
          </div>
        </details>
      </div>
    </li>
  )
}
