const links = ['Workspace', 'Drafts']

export function DashboardSidebar() {
  return (
    <aside className="flex min-h-full flex-col bg-[#0f1318] px-5 py-7">
      <div className="px-1">
        <p className="text-[10px] tracking-[0.14em] text-white/42">Workspace</p>
        <p className="mt-3 text-sm leading-relaxed tracking-[0.01em] text-white/62">Autosave enabled · Stored on this device</p>
      </div>

      <nav className="mt-8 space-y-1.5" aria-label="Workspace navigation">
        {links.map((item) => (
          <button
            key={item}
            type="button"
            className={`flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2.5 text-left text-xs tracking-[0.04em] transition-[background-color,color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1318] motion-reduce:transition-none ${
              item === 'Workspace'
                ? 'bg-[#1a2129] text-white/84 ring-1 ring-white/[0.08]'
                : 'text-white/42 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/72'
            }`}
          >
            <span className="flex items-center gap-2">
              {item === 'Workspace' ? <span className="h-4 w-px bg-[#d6b85d]" aria-hidden /> : null}
              {item}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
