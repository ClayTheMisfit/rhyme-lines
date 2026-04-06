import Link from 'next/link'
import type { ProjectSummary } from '@/lib/projects/storage'

type ManuscriptRowProps = {
  project: ProjectSummary
  view: 'projects' | 'archived'
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
  onDelete?: (id: string) => void
}

const formatUpdatedAt = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Unknown update time' : date.toLocaleString()
}

const actionClassName =
  'ml-2 rounded border border-white/[0.08] px-2 py-1 text-[10px] tracking-[0.1em] text-white/56 hover:text-white/86'

export function ManuscriptRow({ project, view, onArchive, onRestore, onDelete }: ManuscriptRowProps) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-white/[0.032] bg-[#18181a] px-4 py-4.5 sm:px-5 sm:py-5">
      <Link href={`/editor/${project.id}`} className="min-w-0">
        <p className="truncate text-[15px] text-white/88">{project.title}</p>
        <p className="mt-1.5 truncate text-xs tracking-[0.02em] text-white/36">
          {project.preview || 'Empty draft'}
        </p>
        <p className="mt-1 text-[11px] tracking-[0.02em] text-white/28">
          {project.wordCount} words · {project.lineCount} lines · Updated {formatUpdatedAt(project.updatedAt)}
        </p>
      </Link>
      <div className="ml-2 flex items-center">
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
        {onDelete ? (
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
