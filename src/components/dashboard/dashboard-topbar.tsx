type DashboardView = 'projects' | 'archived' | 'trash'

type DashboardTopbarProps = {
  view: DashboardView
  onViewChange: (view: DashboardView) => void
  archivedCount: number
  trashCount: number
  search: string
  onSearchChange: (value: string) => void
}

export function DashboardTopbar({
  view,
  onViewChange,
  archivedCount,
  trashCount,
  search,
  onSearchChange,
}: DashboardTopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/[0.03] px-5 sm:px-7 lg:px-8">
      <div className="text-[13px] font-medium tracking-[0.24em] text-white/82">RHYME LINES</div>

      <nav
        className="flex items-center gap-2 overflow-x-auto px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Dashboard views"
      >
        {[
          { label: 'Projects', value: 'projects' as const },
          { label: 'Archived', value: 'archived' as const },
          { label: 'Trash', value: 'trash' as const },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onViewChange(item.value)}
            aria-pressed={view === item.value}
            className={`whitespace-nowrap rounded border px-2.5 py-1 text-[11px] tracking-[0.12em] ${
              view === item.value
                ? 'border-[#f2d000]/55 bg-[#f2d000]/10 text-[#f2d000]'
                : 'border-white/[0.08] text-white/40 hover:text-white/68'
            }`}
          >
            <span>{item.label}</span>
            {item.value === 'archived' ? (
              <span className="ml-2 rounded border border-white/[0.12] px-1.5 py-0.5 text-[10px] tracking-normal text-white/70">
                {archivedCount}
              </span>
            ) : null}
            {item.value === 'trash' ? (
              <span className="ml-2 rounded border border-white/[0.12] px-1.5 py-0.5 text-[10px] tracking-normal text-white/70">
                {trashCount}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search projects"
          className="hidden h-8 w-48 rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-3 text-xs text-white/70 placeholder:text-white/30 focus:outline-none sm:flex"
          aria-label="Search projects"
        />
        <button type="button" className="dashboard-icon-button" aria-label="Notifications">
          ⎋
        </button>
        <button type="button" className="dashboard-icon-button" aria-label="Workspace settings">
          ⋮
        </button>
      </div>
    </header>
  )
}
