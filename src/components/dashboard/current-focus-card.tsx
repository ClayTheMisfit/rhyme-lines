export function CurrentFocusCard() {
  return (
    <article className="flex min-h-[270px] flex-col border border-white/[0.05] bg-[#18181a] p-5 sm:p-6">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#f2d000]">Current Focus</p>
      <h2 className="mt-4 max-w-xl text-2xl font-medium tracking-tight text-white/90 sm:text-[2rem]">Midnight Ledger — Verse Two Rebuild</h2>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/44">
        Tighten the second verse cadence, resolve internal rhyme drift, and align the closing bar with the hook motif introduced in line six.
      </p>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
        <div className="space-y-1 text-xs text-white/34">
          <p>Word count: 1,486</p>
          <p>Progress: 74% locked</p>
          <p>Last revision: 22:41 UTC</p>
        </div>
        <button type="button" className="h-9 border border-white/[0.12] px-4 text-xs tracking-[0.08em] text-white/74 hover:bg-white/[0.05]">
          CONTINUE DRAFT
        </button>
      </div>
    </article>
  )
}
