import type { ProjectFolder, ProjectSummary } from '@/lib/projects/storage'
import { ManuscriptRow } from './manuscript-row'

type ManuscriptListProps = {
  rows: ProjectSummary[]
  view: 'projects' | 'archived' | 'trash'
  search: string
  folders: ProjectFolder[]
  onRename?: (id: string, title: string) => void
  onAssignFolder?: (id: string, folderId: string | null) => void
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
  onRestoreFromTrash?: (id: string) => void
  onDeletePermanently?: (id: string) => void
  onDelete?: (id: string) => void
}

export function ManuscriptList({
  rows,
  view,
  search,
  folders,
  onRename,
  onAssignFolder,
  onArchive,
  onRestore,
  onRestoreFromTrash,
  onDeletePermanently,
  onDelete,
}: ManuscriptListProps) {
  if (!rows.length) {
    const trimmedSearch = search.trim()
    return (
      <section className="border border-white/[0.032] bg-[#151518] px-5 py-8 text-center">
        <h3 className="text-sm tracking-[0.13em] text-white/74">
          {trimmedSearch
            ? 'No results'
            : view === 'archived'
              ? 'No archived projects'
              : view === 'trash'
                ? 'Trash is empty'
                : 'No projects yet'}
        </h3>
        <p className="mt-2 text-xs text-white/38">
          {trimmedSearch
            ? `No projects matched “${trimmedSearch}”.`
            : view === 'archived'
              ? 'Archived projects will show up here.'
              : view === 'trash'
                ? 'Deleted projects will appear here.'
                : 'Start a new project to begin writing.'}
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm tracking-[0.13em] text-white/74">
          {view === 'archived' ? 'Archived Projects' : view === 'trash' ? 'Trash' : 'Recent Drafts'}
        </h3>
      </div>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <ManuscriptRow
            key={row.id}
            project={row}
            view={view}
            folders={folders}
            onRename={onRename}
            onAssignFolder={onAssignFolder}
            onArchive={onArchive}
            onRestore={onRestore}
            onRestoreFromTrash={onRestoreFromTrash}
            onDeletePermanently={onDeletePermanently}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  )
}
