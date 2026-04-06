type DashboardHeroProps = {
  projectCount: number
  onCreateProject: () => void
}

export function DashboardHero({ projectCount, onCreateProject }: DashboardHeroProps) {
  return (
    <section className="flex flex-wrap items-start justify-between gap-6 border-b border-white/[0.05] pb-9">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/34">Workspace</p>
        <h1 className="mt-4 text-4xl font-medium tracking-tight text-white/92 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.02]">
          Your Workspace
        </h1>
        <p className="mt-3 text-sm text-white/38 sm:text-[15px]">{projectCount} saved project{projectCount === 1 ? '' : 's'}</p>
      </div>

      <button
        type="button"
        onClick={onCreateProject}
        className="mt-3 inline-flex h-10 items-center self-end border border-[#f2d000] bg-[#f2d000] px-5 text-xs font-medium tracking-[0.1em] text-black sm:mt-6"
      >
        NEW PROJECT
      </button>
    </section>
  )
}
