const navItems = ['Projects', 'Library', 'Archive']

export function DashboardTopbar() {
  return (
    <header className="flex h-[54px] items-center justify-between border-b border-white/[0.05] px-4 sm:px-6 lg:px-8">
      <div className="text-sm font-medium tracking-[0.22em] text-white/85">RHYME LINES</div>

      <nav className="hidden items-center gap-6 md:flex">
        {navItems.map((item) => (
          <button
            key={item}
            type="button"
            className={`text-xs tracking-[0.16em] ${
              item === 'Projects' ? 'text-[#f2d000]' : 'text-white/45 hover:text-white/75'
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden h-8 w-44 items-center border border-white/[0.06] bg-white/[0.02] px-3 text-xs text-white/40 sm:flex">
          Search manuscripts
        </div>
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
