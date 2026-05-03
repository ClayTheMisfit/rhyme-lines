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
            className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-xs tracking-[0.04em] ${
              item === 'Workspace'
                ? 'bg-[#1a2129] text-white/84'
                : 'text-white/42'
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
