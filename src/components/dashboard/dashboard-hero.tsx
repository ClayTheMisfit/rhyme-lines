import type { ProjectSummary } from '@/lib/projects/storage'

type DashboardHeroProps = {
  projectCount: number
  onCreateProject: () => void
  latestProject: ProjectSummary | null
  onResumeProject: (id: string) => void
}

const formatUpdatedAt = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? 'Updated recently'
    : `Updated ${date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`
}

export function DashboardHero({
  projectCount,
  onCreateProject,
  latestProject,
  onResumeProject,
}: DashboardHeroProps) {
  return (
    <section className="border-b border-white/[0.05] pb-9">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-white/34">WRITING LAUNCHPAD</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight text-white/92 sm:text-4xl lg:text-[2.9rem] lg:leading-[1.08]">
            Pick up where you left off
          </h1>
          <p className="mt-3 text-sm text-white/42 sm:text-[15px]">
            {projectCount} saved project{projectCount === 1 ? '' : 's'}
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateProject}
          className="inline-flex h-11 items-center self-end rounded-sm border border-[#f2d000] bg-[#f2d000] px-6 text-xs font-medium tracking-[0.1em] text-black transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-[#f6da1a] hover:shadow-[0_0_0_1px_rgba(242,208,0,0.38),0_8px_18px_rgba(242,208,0,0.18)] active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111214] motion-reduce:transform-none motion-reduce:transition-none"
        >
          NEW PROJECT
        </button>
      </div>

      {latestProject ? (
        <div className="mt-7 rounded-sm border border-white/[0.07] bg-white/[0.02] px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-[11px] tracking-[0.12em] text-white/45">RESUME LAST PROJECT</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-base text-white/90">{latestProject.title}</p>
              <p className="mt-1 text-xs text-white/45">{formatUpdatedAt(latestProject.updatedAt)}</p>
            </div>
            <button
              type="button"
              onClick={() => onResumeProject(latestProject.id)}
              className="inline-flex h-9 items-center rounded-sm border border-white/[0.18] bg-white/[0.03] px-4 text-xs tracking-[0.08em] text-white/86 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111214]"
            >
              RESUME WRITING
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
