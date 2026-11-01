import Link from 'next/link'

export function DashboardFooter() {
  return (
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.045] pt-7 text-[11px] text-white/42">
      <div className="flex items-center gap-5">
        <span>Sync: All changes stored locally</span>
        <span>Storage: 63% available</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-right text-white/40">
        <Link href="/privacy" className="rounded-sm underline-offset-4 hover:text-white/72 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/70">Privacy</Link>
        <Link href="/terms" className="rounded-sm underline-offset-4 hover:text-white/72 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/70">Terms</Link>
        <span className="text-white/34">Build rhlines-0.1.0 · vNext workspace shell</span>
      </div>
    </footer>
  )
}
