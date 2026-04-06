import type { ProjectSummary } from '@/lib/projects/storage'
import { ManuscriptRow } from './manuscript-row'

type DashboardView = 'active' | 'archived'

type ManuscriptListProps = {
  rows: ProjectSummary[]
  view: DashboardView
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
  onDelete?: (id: string) => void
}

export function ManuscriptList({ rows, view, onArchive, onRestore, onDelete }: ManuscriptListProps) {
  if (!rows.length) {
    return (
      <section className="border border-white/[0.032] bg-[#18181a] px-5 py-8 text-center">
        <h3 className="text-sm tracking-[0.13em] text-white/74">
          {view === 'active' ? 'No projects yet' : 'No archived projects'}
        </h3>
        <p className="mt-2 text-xs text-white/38">
          {view === 'active' ? 'Start a new project to begin writing.' : 'Archive a project to see it here.'}
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm tracking-[0.13em] text-white/74">
          {view === 'active' ? 'Saved Manuscripts' : 'Archived Manuscripts'}
        </h3>
      </div>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <ManuscriptRow
            key={row.id}
            project={row}
            view={view}
            onArchive={onArchive}
            onRestore={onRestore}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  )
}
