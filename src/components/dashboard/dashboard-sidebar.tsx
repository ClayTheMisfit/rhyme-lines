const links = ['Workspace', 'Drafts']

export function DashboardSidebar() {
  return (
    <aside className="flex min-h-full flex-col bg-[#151516] px-5 py-7">
      <div className="border border-white/[0.03] bg-[#1a1a1c] px-4 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/34">Rhyme Lines</p>
        <p className="mt-4 text-base font-medium tracking-tight text-white/88">Local Workspace</p>
        <p className="mt-2 text-xs text-white/34">Autosave enabled · Stored on this device</p>
      </div>

      <nav className="mt-8 space-y-1.5">
        {links.map((item) => (
          <div
            key={item}
            className={`flex w-full items-center justify-between border px-3 py-2.5 text-left text-xs tracking-[0.09em] ${
              item === 'Workspace'
                ? 'border-white/[0.045] bg-[#f2d000]/9 text-white/87'
                : 'border-transparent text-white/28'
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
