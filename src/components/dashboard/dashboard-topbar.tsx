const navItems = ['Projects', 'Library', 'Archive']

export function DashboardTopbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/[0.03] px-5 sm:px-7 lg:px-8">
      <div className="text-[13px] font-medium tracking-[0.24em] text-white/82">RHYME LINES</div>

      <nav className="hidden items-center gap-6 md:flex">
        {navItems.map((item) => (
          <button
            key={item}
            type="button"
            className={`text-xs tracking-[0.16em] ${
              item === 'Projects' ? 'text-[#f2d000]' : 'text-white/40 hover:text-white/68'
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden h-8 w-48 items-center rounded-[6px] border border-white/[0.025] bg-white/[0.006] px-3 text-xs text-white/30 sm:flex">
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
