import Link from 'next/link'
import type { ReactNode } from 'react'

type LegalDocumentProps = {
  title: string
  description: string
  effectiveDate: string
  children: ReactNode
}

export function LegalDocument({ title, description, effectiveDate, children }: LegalDocumentProps) {
  return (
    <main className="min-h-screen bg-[#0d0f12] px-5 py-10 text-[#f2f3f6] sm:px-8 sm:py-14">
      <article className="mx-auto w-full max-w-3xl">
        <nav aria-label="Legal document navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/58">
          <Link href="/" className="rounded-sm text-white/78 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/70">
            Rhyme Lines
          </Link>
          <Link href="/privacy" className="rounded-sm underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/70">
            Privacy
          </Link>
          <Link href="/terms" className="rounded-sm underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]/70">
            Terms
          </Link>
        </nav>

        <header className="mt-12 border-b border-white/[0.08] pb-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#d6b85d]">Legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/64">{description}</p>
          <p className="mt-4 text-sm text-white/45">Effective {effectiveDate}</p>
        </header>

        <div className="legal-document mt-10 space-y-10 text-[15px] leading-7 text-white/72 [&_a]:rounded-sm [&_a]:text-[#e5cf85] [&_a]:underline [&_a]:underline-offset-4 [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-[#d6b85d]/70 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-white [&_h3]:font-semibold [&_h3]:text-white/90 [&_li]:pl-1 [&_p]:mt-3 [&_strong]:font-semibold [&_strong]:text-white/88 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>

        <footer className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.08] pt-7 text-sm text-white/52">
          <Link href="/">Return to the workspace</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </footer>
      </article>
    </main>
  )
}
