const metrics = [
  { label: 'Rhyme density', value: '0.62', note: 'Target 0.65' },
  { label: 'Syllable variance', value: 'Low', note: 'Within tolerance' },
  { label: 'Lexical novelty', value: '71%', note: 'Above project avg' },
]

export function AnalysisCard() {
  return (
    <aside className="flex min-h-[270px] flex-col border border-white/[0.05] bg-[#1b1b1d] p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Analysis Snapshot</p>
      <div className="mt-4 divide-y divide-white/[0.05] border-y border-white/[0.05]">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between py-3">
            <div>
              <p className="text-xs text-white/76">{metric.label}</p>
              <p className="mt-1 text-[11px] text-white/33">{metric.note}</p>
            </div>
            <p className="text-sm text-white/84">{metric.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-auto pt-5 text-xs italic leading-5 text-white/36">
        “Keep line endings harder and reduce multisyllabic stack in bars 9–11.”
      </p>
    </aside>
  )
}
