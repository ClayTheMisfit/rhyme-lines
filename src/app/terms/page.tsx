import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal/legal-document'

export const metadata: Metadata = {
  title: 'Terms of Service | Rhyme Lines',
  description: 'Terms governing use of the Rhyme Lines writing workspace and optional account-backed features.',
}

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      description="These terms govern use of the Rhyme Lines local writing workspace and optional account-backed services."
      effectiveDate="November 3, 2026"
    >
      <section>
        <h2>Using Rhyme Lines</h2>
        <p>
          By using Rhyme Lines, you agree to these Terms and the <a href="/privacy">Privacy Policy</a>. If you do not agree, do not create an account or use account-backed services. You may continue to evaluate the public, local-first workspace subject to these Terms.
        </p>
        <p>You must be legally able to enter into this agreement in the place where you live. Do not use Rhyme Lines where doing so would violate applicable law.</p>
      </section>

      <section>
        <h2>Your writing and local copies</h2>
        <p>
          You keep the rights you have in lyrics, poems, titles, and other material you create. You give Rhyme Lines only the limited permission needed to store, process, synchronize, display, and return your content at your direction and to operate the features you choose.
        </p>
        <p>
          Rhyme Lines is local-first, but browser storage is not a guaranteed backup. Keep independent copies or exports of work you cannot afford to lose. Clearing browser data, changing devices, private browsing, conflicts, or service failures can make a local copy unavailable.
        </p>
      </section>

      <section>
        <h2>Accounts and security</h2>
        <p>
          Rhyme Lines supports email-and-password accounts and can also offer Google sign-in when that provider is configured. Registration requires you to agree to these Terms and acknowledge the <a href="/privacy">Privacy Policy</a>. You must provide information you are authorized to use and complete the applicable email or provider verification.
        </p>
        <p>
          Keep your password, email or Google account, devices, and active Rhyme Lines sessions secure. Use a unique password, sign out on shared devices, and use the password-reset flow or your provider&apos;s recovery controls if you suspect compromise. You are responsible for activity performed through your account unless applicable law provides otherwise.
        </p>
        <p>
          Rhyme Lines does not generally link an existing password identity to a Google identity merely because the email addresses match. Do not attempt to bypass email verification, account-linking restrictions, rate limits, session controls, or other security measures.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>Do not use the service to:</p>
        <ul>
          <li>Break the law, violate another person&apos;s rights, or upload content you do not have permission to use.</li>
          <li>Probe, attack, overload, scrape, or interfere with Rhyme Lines, its users, or its providers.</li>
          <li>Distribute malware, impersonate another person, or attempt unauthorized access to accounts or data.</li>
          <li>Use automated requests in a way that disrupts the application or exceeds provider restrictions.</li>
        </ul>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          Hosting, database, authentication email, sign-in, and online word-suggestion features depend on third parties including Vercel, Neon, Resend, Google when configured, Datamuse, RhymeBrain, and—when configured and called—Wordnik. Those services can change, impose limits, become unavailable, or apply their own terms and privacy practices. Rhyme Lines is not responsible for third-party services outside its control.
        </p>
      </section>

      <section>
        <h2>Service changes and availability</h2>
        <p>
          Rhyme Lines may change, suspend, or discontinue features to maintain security, comply with law, address provider changes, or improve the product. The service is provided on an “as available” basis. To the extent permitted by law, no guarantee is made that it will be uninterrupted, error-free, or suitable for a particular professional or commercial purpose.
        </p>
      </section>

      <section>
        <h2>Ending use and deleting data</h2>
        <p>
          You can stop using Rhyme Lines at any time and clear local site data through your browser. Signed-in users can permanently delete individual cloud documents from the trash; that removes their stored content and version history but keeps a content-free deletion tombstone for synchronization.
        </p>
        <p>
          The current release does not provide self-service account deletion. A monitored support address and account-request procedure must be published before a public account launch. Until then, Rhyme Lines cannot represent that an account-deletion request channel is operational.
        </p>
      </section>

      <section>
        <h2>Disclaimers and responsibility</h2>
        <p>
          Rhyme, syllable, spelling, and related-word suggestions are automated creative aids and may be incomplete or inaccurate. You are responsible for reviewing your writing, securing independent backups, and deciding whether suggestions or generated relationships are appropriate for your work.
        </p>
        <p>
          To the extent permitted by applicable law, Rhyme Lines is provided without warranties beyond any that cannot legally be excluded. Nothing in these Terms limits rights or remedies that applicable consumer law does not allow to be limited.
        </p>
      </section>

      <section>
        <h2>Changes to these Terms</h2>
        <p>Updates will be posted on this page with a revised effective date. Continuing to use account-backed services after an updated version becomes effective means you accept the updated Terms where permitted by law.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          A monitored Rhyme Lines support address and the responsible service operator have not yet been confirmed. This page does not represent that an account-request channel is operational. Publishing those details remains a prerequisite for a public account launch.
        </p>
      </section>
    </LegalDocument>
  )
}
