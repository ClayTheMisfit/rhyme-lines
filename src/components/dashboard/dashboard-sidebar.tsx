const links = ['Workspace', 'Drafts', 'Annotations', 'References', 'Sessions']

export function DashboardSidebar() {
  return (
    <aside className="flex min-h-full flex-col bg-[#151516] px-5 py-7">
      <div className="border border-white/[0.03] bg-[#1a1a1c] px-4 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/34">Current Project</p>
        <p className="mt-4 text-base font-medium tracking-tight text-white/88">Golden Static</p>
        <p className="mt-2 text-xs text-white/34">Drafting Stage · Verse Build</p>
      </div>

      <button type="button" className="mt-5 h-10 border border-[#f2d000] bg-[#f2d000] px-3 text-xs font-medium tracking-[0.1em] text-black">
        NEW VERSE
      </button>

      <nav className="mt-8 space-y-1.5">
        {links.map((item) => (
          <button
            key={item}
            type="button"
            className={`flex w-full items-center justify-between border px-3 py-2.5 text-left text-xs tracking-[0.09em] ${
              item === 'Workspace'
                ? 'border-white/[0.045] bg-[#f2d000]/9 text-white/87'
                : 'border-transparent text-white/28 hover:border-white/[0.04] hover:text-white/58'
            }`}
          >
            <span className="flex items-center gap-2">
              {item === 'Workspace' ? <span className="h-4 w-px bg-[#f2d000]" aria-hidden /> : null}
              {item}
            </span>
            <span className="text-white/18">›</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/[0.028] pt-5">
        <button type="button" className="w-full border border-white/[0.03] bg-white/[0.006] px-3 py-2.5 text-left text-xs tracking-[0.09em] text-white/30 hover:text-white/52">
          Help & Support
        </button>
      </div>
    </aside>
  )
}
