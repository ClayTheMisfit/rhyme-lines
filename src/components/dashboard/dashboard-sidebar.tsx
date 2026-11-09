import Link from 'next/link'

type DashboardSidebarProps = {
  collapsed: boolean
  onToggle: () => void
}

export function DashboardSidebar({ collapsed, onToggle }: DashboardSidebarProps) {
  const toggleLabel = collapsed ? 'Expand workspace sidebar' : 'Collapse workspace sidebar'

  return (
    <aside
      id="dashboard-workspace-sidebar"
      aria-label="Workspace sidebar"
      className={`hidden min-h-full flex-col bg-[#0f1318] py-7 lg:flex ${collapsed ? 'items-center px-2' : 'px-5'}`}
    >
      <div className={`flex w-full items-center ${collapsed ? 'justify-center' : 'justify-between px-1'}`}>
        {!collapsed ? (
          <p className="text-[10px] tracking-[0.14em] text-white/42">Workspace</p>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          aria-controls="dashboard-workspace-navigation"
          title={toggleLabel}
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/[0.08] text-white/64 transition-[background-color,border-color,color] duration-150 hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/70 motion-reduce:transition-none"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={collapsed ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
          </svg>
        </button>
      </div>

      {!collapsed ? (
        <>
          <p className="mt-3 px-1 text-sm leading-relaxed tracking-[0.01em] text-white/62">
            Autosave enabled · Stored on this device
          </p>
          <nav id="dashboard-workspace-navigation" className="mt-8 space-y-1.5" aria-label="Workspace navigation">
            <Link
              href="/"
              aria-current="page"
              className="flex w-full items-center rounded-md border border-transparent bg-[#1a2129] px-3 py-2.5 text-left text-xs tracking-[0.04em] text-white/84 ring-1 ring-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/70"
            >
              <span className="mr-2 h-4 w-px bg-[#d6b85d]" aria-hidden="true" />
              Workspace
            </Link>
          </nav>
        </>
      ) : (
        <nav id="dashboard-workspace-navigation" className="mt-7" aria-label="Workspace navigation">
          <Link
            href="/"
            aria-label="Workspace"
            aria-current="page"
            title="Workspace"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#1a2129] text-[#d6b85d] ring-1 ring-white/[0.08] hover:bg-[#202933] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/70"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 10 9-7 9 7v11h-6v-6H9v6H3V10Z" />
            </svg>
          </Link>
        </nav>
      )}
    </aside>
  )
}
