import TopBar from '@/components/TopBar'
import EditorShell from '@/components/EditorShell'

export default function EditorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <TopBar />
      <div className="flex min-h-0 flex-1" style={{ paddingTop: 'var(--header-height, 48px)' }}>
        <aside className="hidden w-[236px] flex-col border-r border-white/[0.04] bg-[#111112] px-4 py-5 lg:flex">
          <div className="border border-white/[0.04] bg-[#171718] px-3.5 py-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/32">Current Project</p>
            <p className="mt-3 text-sm tracking-tight text-white/86">Golden Static</p>
            <p className="mt-1 text-xs text-white/30">Act II · Night Session</p>
          </div>

          <nav className="mt-6 space-y-1.5">
            {['Editor', 'Rhymes', 'Thesaurus', 'Structure'].map((item) => (
              <button
                key={item}
                type="button"
                className={`flex w-full items-center justify-between border px-3 py-2 text-left text-xs tracking-[0.09em] ${
                  item === 'Editor'
                    ? 'border-white/[0.06] bg-[#f2d000]/10 text-white/88'
                    : 'border-transparent text-white/30 hover:border-white/[0.04] hover:text-white/58'
                }`}
              >
                {item}
                <span className="text-white/18">›</span>
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="mt-6 h-9 border border-[#f2d000] bg-[#f2d000] text-xs font-medium tracking-[0.09em] text-black"
          >
            NEW VERSE
          </button>

          <button
            type="button"
            className="mt-auto border border-white/[0.03] bg-white/[0.01] px-3 py-2 text-left text-xs tracking-[0.09em] text-white/30 hover:text-white/50"
          >
            Help & Support
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex min-h-0 flex-1">
            <EditorShell />
          </main>
          <footer className="flex h-9 items-center justify-between border-t border-white/[0.04] bg-[#0f0f10] px-4 text-[11px] tracking-[0.08em] text-white/28 sm:px-6">
            <div className="flex items-center gap-4">
              <span>Scheme: AABB</span>
              <span className="text-[#f2d000]/90">Sync: saved</span>
              <span>Words: 1,486</span>
            </div>
            <span>UTF-8 · Session 22:41 UTC</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
