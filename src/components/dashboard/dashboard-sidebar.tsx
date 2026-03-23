const links = ['Workspace', 'Drafts', 'Annotations', 'References', 'Sessions']

export function DashboardSidebar() {
  return (
    <aside className="flex min-h-full flex-col bg-[#151516] px-4 py-5 sm:px-5">
      <div className="border border-white/[0.05] bg-[#1a1a1c] p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">Current Project</p>
        <p className="mt-2 text-sm text-white/85">Golden Static</p>
        <p className="mt-1 text-xs text-white/35">Drafting Stage · Verse Build</p>
      </div>

      <button type="button" className="mt-3 h-9 border border-[#f2d000] bg-[#f2d000] px-3 text-xs font-medium tracking-[0.08em] text-black">
        NEW VERSE
      </button>

      <nav className="mt-6 space-y-1">
        {links.map((item) => (
          <button
            key={item}
            type="button"
            className={`flex w-full items-center justify-between border px-3 py-2 text-left text-xs tracking-[0.08em] ${
              item === 'Workspace'
                ? 'border-[#f2d000]/40 bg-[#f2d000]/10 text-white/90'
                : 'border-transparent text-white/40 hover:border-white/[0.08] hover:text-white/72'
            }`}
          >
            {item}
            <span className="text-white/25">›</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/[0.05] pt-4">
        <button type="button" className="w-full border border-white/[0.06] bg-white/[0.01] px-3 py-2 text-left text-xs tracking-[0.08em] text-white/45 hover:text-white/75">
          Help & Support
        </button>
      </div>
    </aside>
  )
}
