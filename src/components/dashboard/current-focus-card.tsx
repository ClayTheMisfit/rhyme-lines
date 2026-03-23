export function CurrentFocusCard() {
  return (
    <article className="relative flex min-h-[320px] flex-col overflow-hidden border border-white/[0.05] bg-[#18181a] p-6 sm:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-[#f2d000]/55" />
      <p className="text-[10px] uppercase tracking-[0.24em] text-[#f2d000]">Current Focus</p>
      <h2 className="mt-5 max-w-2xl text-[2rem] font-medium tracking-tight text-white/92 sm:text-[2.25rem] sm:leading-[1.08]">
        Midnight Ledger — Verse Two Rebuild
      </h2>
      <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/44">
        Tighten the second verse cadence, resolve internal rhyme drift, and align the closing bar with the hook motif introduced in line six.
      </p>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-white/[0.06] pt-8">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="border border-white/[0.09] bg-[#202022] px-2.5 py-1.5 text-white/56">Word count: 1,486</span>
          <span className="border border-white/[0.09] bg-[#202022] px-2.5 py-1.5 text-white/56">Progress: 74% locked</span>
          <span className="border border-white/[0.09] bg-[#202022] px-2.5 py-1.5 text-white/56">Last revision: 22:41 UTC</span>
        </div>
        <button type="button" className="h-9 border border-white/[0.12] px-4 text-xs tracking-[0.1em] text-white/74 hover:bg-white/[0.05]">
          CONTINUE DRAFT
        </button>
      </div>
    </article>
  )
}
