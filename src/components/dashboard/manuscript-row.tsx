import Link from 'next/link'
import type { ProjectSummary } from '@/lib/projects/storage'

type DashboardView = 'active' | 'archived'

type ManuscriptRowProps = {
  project: ProjectSummary
  view: DashboardView
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
  onDelete?: (id: string) => void
}

const formatDateTime = (iso: string | null | undefined, fallback = 'Unknown time') => {
  if (!iso) return fallback
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString()
}

export function ManuscriptRow({ project, view, onArchive, onRestore, onDelete }: ManuscriptRowProps) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-white/[0.032] bg-[#18181a] px-4 py-4.5 sm:px-5 sm:py-5">
      <div className="min-w-0">
        <p className="truncate text-[15px] text-white/88">{project.title}</p>
        <p className="mt-1.5 truncate text-xs tracking-[0.02em] text-white/36">{project.preview || 'Empty draft'}</p>
        <p className="mt-1 text-[11px] tracking-[0.02em] text-white/28">
          {project.wordCount} words · {project.lineCount} lines · Updated {formatDateTime(project.updatedAt)}
        </p>
        {view === 'archived' ? (
          <p className="mt-1 text-[11px] tracking-[0.02em] text-white/28">Archived {formatDateTime(project.archivedAt)}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/editor/${project.id}`}
          className="inline-flex h-8 items-center rounded-sm border border-white/[0.08] px-3 text-xs tracking-[0.08em] text-white/74 hover:bg-white/[0.05]"
        >
          Open
        </Link>

        {view === 'active' ? (
          <button
            type="button"
            onClick={() => onArchive?.(project.id)}
            className="inline-flex h-8 items-center rounded-sm border border-white/[0.08] px-3 text-xs tracking-[0.08em] text-white/74 hover:bg-white/[0.05]"
          >
            Archive
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onRestore?.(project.id)}
            className="inline-flex h-8 items-center rounded-sm border border-white/[0.08] px-3 text-xs tracking-[0.08em] text-white/74 hover:bg-white/[0.05]"
          >
            Restore
          </button>
        )}

        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(project.id)}
            className="inline-flex h-8 w-8 items-center justify-center text-white/28 hover:text-white/56"
            aria-label={`Delete ${project.title}`}
          >
            ✕
          </button>
        ) : null}
      </div>
    </li>
  )
}
