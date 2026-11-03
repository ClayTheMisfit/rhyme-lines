import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal/legal-document'

export const metadata: Metadata = {
  title: 'Privacy Policy | Rhyme Lines',
  description: 'How Rhyme Lines handles local drafts, account data, cloud documents, and authentication information.',
}

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="This policy explains what Rhyme Lines processes when you write locally, create an account, sync documents, or use online rhyme assistance."
      effectiveDate="November 1, 2026"
    >
      <section>
        <h2>Local-first writing</h2>
        <p>
          You can use the writing workspace without an account. Draft text, titles, folders, editor settings, panel state, and related workspace metadata are stored in your browser&apos;s local storage. That local data stays on the device and browser profile where it was created unless you sign in and cloud sync uploads a document.
        </p>
        <p>
          Clearing site data, using a private-browsing session, resetting the browser profile, or losing the device can remove local data. Rhyme Lines does not receive local-only drafts through the application database.
        </p>
      </section>

      <section>
        <h2>Information processed for accounts</h2>
        <p>In the current release, account access uses Google sign-in. When you choose Google sign-in, Rhyme Lines processes:</p>
        <ul>
          <li>Your Google-provided display name, email address, email-verification status, and profile image, when available.</li>
          <li>Your Google provider identifier and account identifier.</li>
          <li>OAuth records returned for the connection, which can include access and refresh tokens, an ID token, token type, scope, expiration time, and provider session state.</li>
          <li>A random database-backed session token, its expiration time, and the account it belongs to.</li>
        </ul>
        <p>
          OAuth and session records remain server-side and are used to connect the Google account, keep the browser signed in, and authorize account-backed features. Rhyme Lines does not receive your Google password.
        </p>
        <p>
          Email-and-password registration, email verification, and password recovery are planned in a separate change but are <strong>not available in this release</strong>. Before those features are activated, this policy must be updated to describe the enabled sign-in providers, password hashes, verification and recovery records, abuse-prevention records, session controls, transactional-email provider, and applicable retention periods.
        </p>
      </section>

      <section>
        <h2>Cloud documents and version history</h2>
        <p>
          When you are signed in and cloud sync is available, Rhyme Lines can store document titles, lyric or writing content, stable line identifiers, client timestamps, archive or trash state, pin and ordering metadata, revision numbers, and version-history snapshots in the application database. The current implementation creates history checkpoints for synced documents and does not set a fixed automatic retention period for those checkpoints.
        </p>
        <p>
          Moving a cloud document to trash does not immediately erase it. Choosing permanent deletion removes that document&apos;s stored version-history rows and replaces the cloud document with a deletion tombstone so other signed-in devices can learn that it was deleted. The tombstone does not contain the deleted title or writing content.
        </p>
      </section>

      <section>
        <h2>Rhyme and thesaurus providers</h2>
        <p>
          Rhyme Lines includes an on-device rhyme database. If online fallback assistance is used, the current target word—not the complete document—is sent in a request to <a href="https://www.datamuse.com/api/" target="_blank" rel="noreferrer">Datamuse</a> and <a href="https://rhymebrain.com/api.html" target="_blank" rel="noreferrer">RhymeBrain</a>. Datamuse is also used for online synonym and related-word suggestions.
        </p>
        <p>
          A server-side <a href="https://wordnik.com/privacy" target="_blank" rel="noreferrer">Wordnik</a> integration exists for word suggestions when it is configured and called, but it is not part of the active default rhyme-provider list. These providers receive the queried word and ordinary request metadata under their own policies. Do not use an online suggestion query for text you do not want transmitted to the applicable provider.
        </p>
      </section>

      <section>
        <h2>Infrastructure and sign-in providers</h2>
        <ul>
          <li><a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noreferrer">Vercel</a> hosts the application and may process network, request, runtime, and security logs needed to deliver and protect it.</li>
          <li><a href="https://neon.com/security" target="_blank" rel="noreferrer">Neon</a> provides the PostgreSQL database used for account records, authentication records, cloud documents, and version history.</li>
          <li><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a> provides the current sign-in service and processes the sign-in request under its own privacy policy.</li>
        </ul>
        <p>Rhyme Lines does not currently configure a third-party advertising or product-analytics service.</p>
      </section>

      <section>
        <h2>Cookies and browser storage</h2>
        <p>
          Authentication uses an HTTP-only session cookie so the server can recognize a signed-in browser. Local drafts and preferences use browser local storage rather than an account cookie. Your browser controls whether cookies and local storage are available; blocking them can prevent account or persistence features from working.
        </p>
      </section>

      <section>
        <h2>Retention and deletion choices</h2>
        <ul>
          <li><strong>Local data:</strong> remains in the browser until you delete projects, clear the relevant Rhyme Lines site data, or the browser removes it.</li>
          <li><strong>Cloud documents:</strong> remain until you permanently delete them. Permanent deletion removes stored content and version history but retains a content-free deletion tombstone.</li>
          <li><strong>Account data:</strong> the current release does not include self-service account deletion or a published retention schedule for account records.</li>
          <li><strong>Operational records:</strong> hosting, sign-in, and database providers may retain logs and backups according to their own service policies and contractual obligations.</li>
        </ul>
      </section>

      <section>
        <h2>Security and your responsibilities</h2>
        <p>
          Rhyme Lines uses HTTPS in production, HTTP-only session cookies, and server-side account and session records. No storage or transmission method is completely secure. Protect access to your Google account and devices, and sign out of Rhyme Lines on a shared device. If you suspect your Google account has been compromised, use Google&apos;s account-security and recovery controls.
        </p>
      </section>

      <section>
        <h2>Access, correction, and account-data requests</h2>
        <p>
          There is not yet a self-service workflow for exporting or deleting an entire account. A monitored Rhyme Lines privacy and support address has not been confirmed, so this page does not represent that an account-request channel is operational. Publishing a contact method, establishing a request-handling process, and identifying the responsible service operator remain public-launch prerequisites.
        </p>
      </section>

      <section>
        <h2>Policy changes</h2>
        <p>Material changes will be posted on this page with a revised effective date. This page describes the current Google sign-in release and must be updated before unreleased password authentication or a different provider configuration is activated.</p>
      </section>
    </LegalDocument>
  )
}
