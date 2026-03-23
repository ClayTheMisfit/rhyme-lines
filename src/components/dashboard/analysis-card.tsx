const metrics = [
  { label: 'Rhyme density', value: '0.62', note: 'Target 0.65' },
  { label: 'Syllable variance', value: 'Low', note: 'Within tolerance' },
  { label: 'Lexical novelty', value: '71%', note: 'Above project avg' },
]

export function AnalysisCard() {
  return (
    <aside className="flex min-h-[320px] flex-col border border-white/[0.04] bg-[#1b1b1d] px-6 py-6">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/36">Analysis Snapshot</p>
      <div className="mt-6 divide-y divide-white/[0.035] border-y border-white/[0.04]">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between py-4.5">
            <div>
              <p className="text-[13px] text-white/74">{metric.label}</p>
              <p className="mt-1.5 text-[11px] tracking-[0.02em] text-white/30">{metric.note}</p>
            </div>
            <p className="text-[15px] text-white/82">{metric.value}</p>
          </div>
        ))}
      </div>
      <blockquote className="mt-auto border-t border-white/[0.035] pt-6">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/28">Editor Note</p>
        <p className="mt-2 text-xs italic leading-6 text-white/35">
          “Keep line endings harder and reduce multisyllabic stack in bars 9–11.”
        </p>
      </blockquote>
    </aside>
  )
}
