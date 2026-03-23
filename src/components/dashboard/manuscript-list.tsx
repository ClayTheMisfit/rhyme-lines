import { ManuscriptRow } from './manuscript-row'

type Manuscript = {
  id: string
  title: string
  meta: string
  status: string[]
}

type ManuscriptListProps = {
  rows: Manuscript[]
}

export function ManuscriptList({ rows }: ManuscriptListProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm tracking-[0.13em] text-white/74">Saved Manuscripts</h3>
        <button type="button" className="text-xs tracking-[0.1em] text-white/40 hover:text-white/68">
          VIEW ALL
        </button>
      </div>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <ManuscriptRow key={row.id} title={row.title} meta={row.meta} status={row.status} />
        ))}
      </ul>
    </section>
  )
}
