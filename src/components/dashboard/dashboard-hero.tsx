import Link from 'next/link'

export function DashboardHero() {
  return (
    <section className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.05] pb-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/34">Workspace</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-white/90 sm:text-4xl">Your Workspace</h1>
        <p className="mt-2 text-sm text-white/38">3 active manuscripts · 2 archived fragments · Focus session available</p>
      </div>

      <Link
        href="/editor"
        className="inline-flex h-10 items-center border border-[#f2d000] bg-[#f2d000] px-4 text-xs font-medium tracking-[0.09em] text-black"
      >
        OPEN STUDIO
      </Link>
    </section>
  )
}
