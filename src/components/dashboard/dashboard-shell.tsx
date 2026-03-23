import { DashboardTopbar } from './dashboard-topbar'
import { DashboardSidebar } from './dashboard-sidebar'
import { DashboardHero } from './dashboard-hero'
import { CurrentFocusCard } from './current-focus-card'
import { AnalysisCard } from './analysis-card'
import { ManuscriptList } from './manuscript-list'
import { DashboardFooter } from './dashboard-footer'

const manuscripts = [
  {
    id: 'm-1',
    title: 'Midnight Ledger',
    meta: 'Draft 03 · 1,486 words · Updated 2h ago',
    status: ['In Revision', 'Sync: Local'],
  },
  {
    id: 'm-2',
    title: 'Neon Psalms',
    meta: 'Draft 07 · 2,140 words · Updated yesterday',
    status: ['Ready for Review', 'Cloud'],
  },
  {
    id: 'm-3',
    title: 'Concrete Lullaby',
    meta: 'Draft 01 · 824 words · Updated 3 days ago',
    status: ['Early Draft'],
  },
]

export function DashboardShell() {
  return (
    <div className="dashboard-page min-h-screen bg-[#090909] text-white">
      <DashboardTopbar />
      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)]">
        <DashboardSidebar />

        <main className="flex min-w-0 flex-col border-l border-white/[0.05] px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
          <DashboardHero />

          <section className="mt-10 grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,1fr)]">
            <CurrentFocusCard />
            <AnalysisCard />
          </section>

          <section className="mt-10 min-w-0">
            <ManuscriptList rows={manuscripts} />
          </section>

          <DashboardFooter />
        </main>
      </div>
    </div>
  )
}
