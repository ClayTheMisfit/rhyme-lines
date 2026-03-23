type ManuscriptRowProps = {
  title: string
  meta: string
  status: string[]
}

export function ManuscriptRow({ title, meta, status }: ManuscriptRowProps) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 border border-white/[0.04] bg-[#18181a] px-4 py-4.5 sm:px-5 sm:py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-white/[0.05] bg-[#202023] text-[11px] text-white/45">
        ✎
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] text-white/88">{title}</p>
        <p className="mt-1.5 truncate text-xs tracking-[0.02em] text-white/36">{meta}</p>
      </div>
      <div className="hidden items-center gap-2.5 sm:flex">
        {status.map((chip) => (
          <span key={chip} className="rounded-[6px] border border-white/[0.05] bg-white/[0.012] px-2.5 py-1 text-[10px] tracking-[0.08em] text-white/48">
            {chip}
          </span>
        ))}
      </div>
      <button type="button" className="mr-1 text-white/28 hover:text-white/56" aria-label="More manuscript actions">
        ⋯
      </button>
    </li>
  )
}
