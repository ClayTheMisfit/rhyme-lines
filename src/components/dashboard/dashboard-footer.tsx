export function DashboardFooter() {
  return (
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-7 text-[11px] text-white/28">
      <div className="flex items-center gap-5">
        <span>Sync: All changes stored locally</span>
        <span>Storage: 63% available</span>
      </div>
      <span>Build rhlines-0.1.0 · vNext workspace shell</span>
    </footer>
  )
}
