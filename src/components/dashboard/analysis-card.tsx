const metrics = [
  { label: 'Rhyme density', value: '0.62', note: 'Target 0.65' },
  { label: 'Syllable variance', value: 'Low', note: 'Within tolerance' },
  { label: 'Lexical novelty', value: '71%', note: 'Above project avg' },
]

export function AnalysisCard() {
  return (
    <aside className="flex min-h-[320px] flex-col border border-white/[0.05] bg-[#1b1b1d] px-5 py-6">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/36">Analysis Snapshot</p>
      <div className="mt-5 divide-y divide-white/[0.05] border-y border-white/[0.05]">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between py-4">
            <div>
              <p className="text-[13px] text-white/78">{metric.label}</p>
              <p className="mt-1 text-[11px] tracking-[0.02em] text-white/33">{metric.note}</p>
            </div>
            <p className="text-base text-white/86">{metric.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-auto border-t border-white/[0.05] pt-6 text-xs italic leading-6 text-white/36">
        “Keep line endings harder and reduce multisyllabic stack in bars 9–11.”
      </p>
    </aside>
  )
}
