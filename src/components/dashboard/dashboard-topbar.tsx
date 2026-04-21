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
  const views = [
    { label: 'Projects', value: 'projects' as const },
    { label: 'Archived', value: 'archived' as const },
    { label: 'Trash', value: 'trash' as const },
  ]

  return (
    <header className="flex h-14 items-center justify-between border-b border-white/[0.03] px-5 sm:px-7 lg:px-8">
      <div className="text-[12px] font-medium tracking-[0.2em] text-white/70">RHYME LINES</div>

      <nav
        className="hidden items-center gap-2 overflow-x-auto px-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden"
        aria-label="Dashboard views"
      >
        {views.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onViewChange(item.value)}
            aria-pressed={view === item.value}
            className={`whitespace-nowrap rounded border px-2.5 py-1 text-[11px] tracking-[0.1em] transition-colors ${
              view === item.value
                ? 'border-[#f2d000]/55 bg-[#f2d000]/10 text-[#f2d000]'
                : 'border-white/[0.05] text-white/38 hover:text-white/62'
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

      <div className="sm:hidden">
        <label className="sr-only" htmlFor="dashboard-view-select">
          Dashboard view
        </label>
        <select
          id="dashboard-view-select"
          value={view}
          onChange={(event) => onViewChange(event.target.value as DashboardView)}
          className="h-8 max-w-[9rem] rounded border border-white/[0.1] bg-[#0f1014] px-2 text-[11px] tracking-[0.08em] text-white/75 focus:outline-none"
          aria-label="Dashboard view"
        >
          {views.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
              {item.value === 'archived' ? ` (${archivedCount})` : ''}
              {item.value === 'trash' ? ` (${trashCount})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search projects"
          className="hidden h-8 w-52 rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-3 text-xs text-white/70 placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101114] sm:flex"
          aria-label="Search projects"
        />
        <span className="hidden text-[10px] tracking-[0.08em] text-white/35 md:inline">Local-only workspace</span>
      </div>
    </header>
  )
}
