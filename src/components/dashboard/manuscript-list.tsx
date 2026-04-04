import type { ProjectSummary } from '@/lib/projects/storage'
import { ManuscriptRow } from './manuscript-row'

type ManuscriptListProps = {
  rows: ProjectSummary[]
  onDelete?: (id: string) => void
}

export function ManuscriptList({ rows, onDelete }: ManuscriptListProps) {
  if (!rows.length) {
    return (
      <section className="border border-white/[0.032] bg-[#18181a] px-5 py-8 text-center">
        <h3 className="text-sm tracking-[0.13em] text-white/74">No saved projects yet</h3>
        <p className="mt-2 text-xs text-white/38">Start a new project to begin writing.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm tracking-[0.13em] text-white/74">Saved Manuscripts</h3>
      </div>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <ManuscriptRow key={row.id} project={row} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  )
}
