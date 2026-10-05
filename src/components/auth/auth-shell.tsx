import Link from 'next/link'
import type { ReactNode } from 'react'

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#090a0d] text-white">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[minmax(22rem,0.9fr)_minmax(28rem,1.1fr)]">
        <aside className="relative hidden overflow-hidden border-r border-white/8 px-10 py-9 lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_70%,rgba(214,184,93,0.09),transparent_34%),radial-gradient(circle_at_70%_30%,rgba(76,136,164,0.08),transparent_40%)]" aria-hidden="true" />
          <Link href="/" className="relative w-fit text-sm font-semibold tracking-[0.12em] text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d] focus-visible:ring-offset-4 focus-visible:ring-offset-[#090a0d]">RHYME LINES</Link>
          <div className="relative max-w-lg space-y-8">
            <p className="font-[family-name:var(--rl-font-editor)] text-2xl leading-relaxed text-white/92 xl:text-3xl">A quiet place for the line you have not written yet.</p>
            <p className="max-w-md text-base leading-7 text-white/58">Write first. Sign in when you want account-backed features.</p>
            <div className="grid grid-cols-3 gap-5 border-t border-white/10 pt-6 text-xs text-white/48">
              <span>Local save first</span><span>Cloud sync second</span><span>Your drafts stay yours</span>
            </div>
          </div>
          <p className="relative text-xs text-white/35">Distraction-free writing, with an account only when you want one.</p>
        </aside>
        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-14">
          <div className="w-full max-w-[30rem]">
            <Link href="/" className="mb-10 inline-flex text-xs font-semibold tracking-[0.12em] text-white/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d] lg:hidden">RHYME LINES</Link>
            <header className="mb-8 space-y-2">
              <h1 className="text-3xl font-medium tracking-[-0.03em] text-white sm:text-4xl">{title}</h1>
              <p className="text-sm leading-6 text-white/52">{description}</p>
            </header>
            {children}
            <Link href="/" className="mt-7 flex min-h-12 items-center justify-center rounded-lg text-sm text-white/62 underline decoration-white/25 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]">
              Continue without an account
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
