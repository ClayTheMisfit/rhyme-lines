const links = ['Workspace', 'Drafts']

export function DashboardSidebar() {
  return (
    <aside className="flex min-h-full flex-col bg-[#121214] px-5 py-7">
      <div className="px-1">
        <p className="text-[10px] tracking-[0.18em] text-white/34">WORKSPACE</p>
        <p className="mt-3 text-sm tracking-[0.01em] text-white/72">Autosave enabled · Stored on this device</p>
      </div>

      <nav className="mt-7 space-y-1" aria-label="Workspace navigation">
        {links.map((item) => (
          <div
            key={item}
            className={`flex w-full items-center justify-between rounded px-3 py-2.5 text-left text-xs tracking-[0.08em] ${
              item === 'Workspace'
                ? 'bg-[#f2d000]/9 text-white/87'
                : 'text-white/30'
            }`}
          >
            <span className="flex items-center gap-2">
              {item === 'Workspace' ? <span className="h-4 w-px bg-[#f2d000]" aria-hidden /> : null}
              {item}
            </span>
          </div>
        ))}
      </nav>
    </aside>
  )
}
