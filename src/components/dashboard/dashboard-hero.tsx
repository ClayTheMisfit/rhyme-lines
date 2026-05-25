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
    <section className="border-b border-white/[0.045] pb-10">
      <div className="flex flex-wrap items-end justify-between gap-7">
        <div>
          <p className="text-[11px] tracking-[0.12em] text-white/47">Writing launchpad</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight text-white/95 sm:text-4xl lg:text-[2.85rem] lg:leading-[1.1]">
            Pick up where you left off
          </h1>
          <p className="mt-3 text-sm text-white/56 sm:text-[15px]">
            {projectCount} saved project{projectCount === 1 ? '' : 's'}
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateProject}
          className="inline-flex h-11 cursor-pointer items-center self-end rounded-md border border-[#d6b85d] bg-[#d6b85d] px-6 text-xs font-semibold tracking-[0.07em] text-[#1b1608] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:bg-[#e0c774] hover:shadow-[0_6px_18px_rgba(214,184,93,0.16)] active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111418] motion-reduce:transform-none motion-reduce:transition-none disabled:cursor-not-allowed"
        >
          NEW PROJECT
        </button>
      </div>

      {latestProject ? (
        <div className="mt-7 rounded-lg bg-[#171c23] px-4 py-4.5 sm:px-5 sm:py-5.5">
          <p className="text-[11px] tracking-[0.1em] text-white/52">Continue writing</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-white/92">{latestProject.title}</p>
              <p className="mt-1 text-xs text-white/54">{formatUpdatedAt(latestProject.updatedAt)}</p>
            </div>
            <button
              type="button"
              onClick={() => onResumeProject(latestProject.id)}
              className="inline-flex h-9 cursor-pointer items-center rounded-md border border-white/[0.14] bg-[#1e252e] px-4 text-xs tracking-[0.06em] text-white/86 transition-[background-color,border-color,color,box-shadow] duration-150 hover:bg-[#232b35] hover:border-white/[0.24] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111418] motion-reduce:transition-none disabled:cursor-not-allowed"
            >
              CONTINUE WRITING
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
