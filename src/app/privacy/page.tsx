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
      effectiveDate="November 3, 2026"
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
        <p>Rhyme Lines supports email-and-password accounts and can also offer Google sign-in when that provider is configured. For an email-and-password registration, Rhyme Lines processes:</p>
        <ul>
          <li>The name and email address you submit, and whether the email address has been verified.</li>
          <li>A salted scrypt password hash after you use a verification link and choose a password. Rhyme Lines does not store the password itself.</li>
          <li>Hashed, single-use verification and password-reset token records, including their type, creation time, expiration time, and whether they have been used. Verification links expire after 24 hours; password-reset links expire after one hour.</li>
          <li>Hashed rate-limit keys, attempt counts, time windows, and temporary block times used to limit login, registration, verification, and recovery abuse. The rate-limit table does not store the raw email address or client address used to derive a key.</li>
        </ul>
        <p>
          Registration first creates a pending account and emails a verification link through Resend. No password or password hash is stored until the person using that link chooses a password. Completing a password reset changes the password hash and invalidates earlier Rhyme Lines sign-in sessions for that account.
        </p>
        <p>When Google sign-in is configured and you choose it, Rhyme Lines can also process:</p>
        <ul>
          <li>Your Google-provided display name, email address, email-verification status, and profile image, when available.</li>
          <li>Your Google provider identifier and account identifier.</li>
          <li>OAuth records returned for the connection, which can include access and refresh tokens, an ID token, token type, scope, expiration time, and provider session state.</li>
        </ul>
        <p>
          OAuth records remain server-side and are used to connect the Google account and authorize account-backed features. Rhyme Lines does not receive your Google password. A matching email address does not generally cause an existing password identity and Google identity to be linked automatically. A verified Google identity can complete a still-pending registration for the same email address before a password credential has been created.
        </p>
        <p>
          Signed-in browsers use an encrypted, HTTP-only JSON Web Token cookie. The application database stores a session-version number for each user so a password reset can reject older cookies. The previous database-session table remains in the schema for compatibility, but the proposed authentication flow does not create new database session-token records.
        </p>
        <p>
          If you acknowledge the legal terms before starting a first-time Google registration, Rhyme Lines places a signed, HTTP-only acknowledgement cookie in your browser for up to ten minutes. It is used only to allow that registration attempt; existing Google-linked accounts do not require it to sign in.
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
          <li><a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">Resend</a> receives the destination email address, authentication message content, and ordinary delivery metadata when Rhyme Lines sends a verification or password-reset email.</li>
          <li><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a> processes a Google sign-in request under its own privacy policy when that optional provider is configured and selected.</li>
        </ul>
        <p>Rhyme Lines does not currently configure a third-party advertising or product-analytics service.</p>
      </section>

      <section>
        <h2>Cookies and browser storage</h2>
        <p>
          Authentication uses an encrypted, HTTP-only session cookie so the server can recognize a signed-in browser. Local drafts and preferences use browser local storage rather than an account cookie. Your browser controls whether cookies and local storage are available; blocking them can prevent account or persistence features from working.
        </p>
      </section>

      <section>
        <h2>Retention and deletion choices</h2>
        <ul>
          <li><strong>Local data:</strong> remains in the browser until you delete projects, clear the relevant Rhyme Lines site data, or the browser removes it.</li>
          <li><strong>Cloud documents:</strong> remain until you permanently delete them. Permanent deletion removes stored content and version history but retains a content-free deletion tombstone.</li>
          <li><strong>Verification and recovery tokens:</strong> expire after 24 hours and one hour respectively. Used or expired records are marked or removed as authentication requests run; cleanup is not represented as immediate deletion at the moment of expiration.</li>
          <li><strong>Rate-limit records:</strong> the application attempts to remove entries that have not been updated for 24 hours. Cleanup is best-effort and runs during later authentication traffic.</li>
          <li><strong>Account data:</strong> there is no self-service account deletion or published retention schedule for the remaining account and credential records.</li>
          <li><strong>Operational records:</strong> hosting, sign-in, and database providers may retain logs and backups according to their own service policies and contractual obligations.</li>
        </ul>
      </section>

      <section>
        <h2>Security and your responsibilities</h2>
        <p>
          Rhyme Lines uses HTTPS in production, salted password hashes, single-use expiring links, encrypted HTTP-only session cookies, rate limits, and server-side session-version checks. No storage or transmission method is completely secure. Use a unique password, protect your email or Google account and devices, and sign out on shared devices.
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
        <p>Material changes will be posted on this page with a revised effective date. The sign-in methods actually available can depend on server configuration; this policy describes the email-and-password flow and the optional Google provider implemented by this release candidate.</p>
      </section>
    </LegalDocument>
  )
}
