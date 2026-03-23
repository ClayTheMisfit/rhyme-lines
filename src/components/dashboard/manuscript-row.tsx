type ManuscriptRowProps = {
  title: string
  meta: string
  status: string[]
}

export function ManuscriptRow({ title, meta, status }: ManuscriptRowProps) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border border-white/[0.05] bg-[#18181a] px-3 py-3 sm:px-4">
      <div className="flex h-9 w-9 items-center justify-center border border-white/[0.08] bg-[#202023] text-xs text-white/50">
        ✎
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-white/88">{title}</p>
        <p className="mt-1 truncate text-xs text-white/36">{meta}</p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        {status.map((chip) => (
          <span key={chip} className="border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[10px] tracking-[0.06em] text-white/54">
            {chip}
          </span>
        ))}
      </div>
      <button type="button" className="text-white/35 hover:text-white/65" aria-label="More manuscript actions">
        ⋯
      </button>
    </li>
  )
}
