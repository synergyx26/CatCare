import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cat, ArrowLeft } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'

const EFFECTIVE_DATE = 'April 26, 2026'
const CONTACT_EMAIL  = 'privacy@catcare.app'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-border/40 pb-2">
        {title}
      </h2>
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 pl-1">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/40">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            {['Third Party', 'Purpose', 'Location'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {rows.map(([party, purpose, location]) => (
            <tr key={party} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{party}</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{purpose}</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PrivacyPolicyPage() {
  usePageTitle('Privacy Policy')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/80 dark:bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Cat className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="font-bold text-sm tracking-tight">CatCare</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective date: {EFFECTIVE_DATE}. Last reviewed: {EFFECTIVE_DATE}.
          </p>
          <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/30 rounded-xl p-4 text-sm text-sky-800 dark:text-sky-300 leading-relaxed">
            <strong>Plain-English summary:</strong> CatCare collects only the data needed to run your
            household's cat care log. We don't sell your data, we don't show you ads, and you can
            delete your account and all associated data at any time from your{' '}
            <Link to="/account" className="underline underline-offset-2 hover:text-sky-600">
              Account settings
            </Link>
            .
          </div>
        </div>

        {/* Table of contents */}
        <nav aria-label="Privacy policy sections">
          <ol className="grid sm:grid-cols-2 gap-1.5 text-sm">
            {[
              ['#controller',   '1. Who We Are (Data Controller)'],
              ['#data',         '2. Data We Collect'],
              ['#use',          '3. How We Use Your Data'],
              ['#legal-basis',  '4. Legal Basis (GDPR)'],
              ['#sharing',      '5. Third Parties & Sub-processors'],
              ['#transfers',    '6. International Data Transfers'],
              ['#retention',    '7. Data Retention'],
              ['#rights',       '8. Your Privacy Rights'],
              ['#security',     '9. Security'],
              ['#cookies',      '10. Cookies & Local Storage'],
              ['#children',     '11. Children'],
              ['#changes',      '12. Changes to This Policy'],
              ['#contact',      '13. Contact & Complaints'],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className="text-sky-600 dark:text-sky-400 hover:underline underline-offset-2 transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="controller" title="1. Who We Are (Data Controller)">
          <P>
            CatCare is operated as an independent service. For the purposes of the UK and EU General
            Data Protection Regulation (UK GDPR / GDPR), CatCare is the <strong>data controller</strong>{' '}
            responsible for personal data processed through this application.
          </P>
          <P>
            If you have any questions about this policy or how we handle your data, please contact us
            at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sky-600 dark:text-sky-400 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </P>
        </Section>

        <Section id="data" title="2. Data We Collect">
          <P>We collect only the data necessary to provide the CatCare service:</P>

          <div className="space-y-4">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1.5">Account &amp; identity data</p>
              <Ul items={[
                'Name and email address (provided during registration)',
                'Password (stored as a bcrypt hash — we never store it in plain text)',
                'Google account identifier (if you choose to sign in with Google)',
                'Subscription tier and notification preferences',
              ]} />
            </div>

            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1.5">Household &amp; care data</p>
              <Ul items={[
                'Household name and settings',
                'Cat profiles: name, species, breed, birthday, photo, vet information, care instructions',
                'Care events: feeding, water, litter, weight, medication, vet visits, grooming, notes — including timestamps and who logged each event',
                'Medication regimens and dose history',
                'Pet expenses (amount, category, description, date)',
                'Household chores and vacation trip records',
                'Emergency contact names and phone numbers you choose to store',
              ]} />
            </div>

            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1.5">Technical &amp; usage data</p>
              <Ul items={[
                'Error reports and stack traces collected by Sentry (may include browser type, OS, and page URL at the time of the error)',
                'Server access logs retained by our hosting provider (Render) for up to 30 days',
                'JWT authentication tokens stored in your browser\'s localStorage',
              ]} />
            </div>

            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1.5">Data we do NOT collect</p>
              <Ul items={[
                'Payment or billing information (not yet implemented)',
                'Location data',
                'Advertising identifiers or cross-site tracking data',
                'Biometric data',
              ]} />
            </div>
          </div>
        </Section>

        <Section id="use" title="3. How We Use Your Data">
          <Ul items={[
            'To create and manage your account and household',
            'To display and synchronise cat care logs across household members',
            'To send transactional emails: password reset links and household invitation emails',
            'To enforce subscription tier limits and process plan changes',
            'To detect and fix bugs using aggregated error reports',
            'To protect against fraud, abuse, and unauthorised access',
          ]} />
          <P>
            We do <strong>not</strong> use your data for targeted advertising, profiling, or sale to
            third parties.
          </P>
        </Section>

        <Section id="legal-basis" title="4. Legal Basis for Processing (GDPR)">
          <P>
            For users in the European Economic Area (EEA) and United Kingdom, we rely on the
            following legal bases:
          </P>
          <div className="space-y-2">
            {[
              ['Contract performance (Art. 6(1)(b))', 'Operating your account, synchronising care logs, processing household invitations.'],
              ['Legitimate interests (Art. 6(1)(f))', 'Security monitoring, fraud prevention, bug detection via error reporting. We have assessed that these interests are not overridden by your rights.'],
              ['Legal obligation (Art. 6(1)(c))', 'Retaining records where required by applicable law.'],
              ['Consent (Art. 6(1)(a))', 'Any optional communications beyond transactional emails. You can withdraw consent at any time via your notification settings.'],
            ].map(([basis, use]) => (
              <div key={basis} className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-0.5">
                <p className="font-medium text-slate-700 dark:text-slate-300 text-xs">{basis}</p>
                <p className="text-xs">{use}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="sharing" title="5. Third Parties &amp; Sub-processors">
          <P>
            We share your data only with the service providers listed below, solely to operate
            CatCare. We have agreements in place with each provider requiring them to protect your
            data. We do not sell data to or share data with advertisers.
          </P>
          <Table rows={[
            ['Render.com',  'Application and API hosting (servers, database)',    'United States'],
            ['Supabase',    'File storage for cat photos',                        'United States / EU'],
            ['Sentry',      'Error tracking and performance monitoring',           'United States'],
            ['Resend',      'Transactional email delivery',                        'United States'],
            ['Google',      'OAuth sign-in (if you choose "Sign in with Google")', 'United States'],
          ]} />
        </Section>

        <Section id="transfers" title="6. International Data Transfers">
          <P>
            CatCare is hosted in the United States. If you are located in the EEA, UK, or another
            jurisdiction with data transfer restrictions, your personal data will be transferred to
            and processed in the US.
          </P>
          <P>
            We rely on the following safeguards for these transfers:
          </P>
          <Ul items={[
            'EU–US Data Privacy Framework (where our sub-processors are certified)',
            'Standard Contractual Clauses (SCCs) adopted by the European Commission, incorporated into our agreements with sub-processors',
          ]} />
          <P>
            You may request a copy of the relevant transfer safeguards by contacting us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sky-600 dark:text-sky-400 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </P>
        </Section>

        <Section id="retention" title="7. Data Retention">
          <P>
            We retain your personal data for as long as your account is active. Specifically:
          </P>
          <Ul items={[
            'Account data (name, email) — retained until you delete your account',
            'Household and care data — retained until the household is deleted or you delete your account',
            'Error logs (Sentry) — retained for 90 days, then automatically purged',
            'Server access logs — retained by Render for up to 30 days',
            'Backup data — may persist for up to 30 days after deletion in encrypted backups',
          ]} />
          <P>
            When you delete your account, your personal data is removed. In households with other
            active members, care events and records you created are <strong>anonymised</strong>{' '}
            (the link to your identity is removed) rather than deleted, to preserve the shared
            household history that other members depend on.
          </P>
        </Section>

        <Section id="rights" title="8. Your Privacy Rights">
          <P>
            Depending on your location, you may have the following rights. Contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sky-600 dark:text-sky-400 hover:underline">
              {CONTACT_EMAIL}
            </a>{' '}
            to exercise any of them. We will respond within 30 days.
          </P>
          <div className="space-y-2">
            {[
              ['Right of access', 'Request a copy of the personal data we hold about you.'],
              ['Right to rectification', 'Correct inaccurate or incomplete personal data at any time from within the app.'],
              ['Right to erasure ("right to be forgotten")', 'Delete your account and all associated personal data directly from your Account settings page. No need to contact us.'],
              ['Right to data portability', 'Request a machine-readable export of your personal data. Contact us at ' + CONTACT_EMAIL + '.'],
              ['Right to restriction', 'Ask us to pause processing of your data while a dispute is resolved.'],
              ['Right to object', 'Object to processing based on legitimate interests. We will cease processing unless we can demonstrate compelling legitimate grounds.'],
              ['Right to withdraw consent', 'Where processing is based on consent, you may withdraw at any time via notification settings or by deleting your account.'],
            ].map(([right, desc]) => (
              <div key={right} className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-0.5">
                <p className="font-medium text-slate-700 dark:text-slate-300 text-xs">{right}</p>
                <p className="text-xs">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 p-4 space-y-1.5">
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wide">California residents (CCPA / CPRA)</p>
            <Ul items={[
              'Right to know what personal information we collect, use, and disclose',
              'Right to delete personal information (available directly in-app)',
              'Right to correct inaccurate personal information',
              'Right to opt out of the sale or sharing of personal information — we do not sell or share your data for advertising',
              'Right to non-discrimination for exercising your privacy rights',
            ]} />
            <p className="text-xs">
              To submit a verifiable consumer request, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-700 dark:text-amber-400 hover:underline">
                {CONTACT_EMAIL}
              </a>
              . We will respond within 45 days.
            </p>
          </div>
        </Section>

        <Section id="security" title="9. Security">
          <P>
            We implement industry-standard technical and organisational measures to protect your data:
          </P>
          <Ul items={[
            'All data in transit is encrypted using TLS 1.2 or higher (HTTPS enforced)',
            'Passwords are hashed using bcrypt with a cost factor of 12',
            'JWT authentication tokens are signed and expire after 14 days; logout immediately revokes the token',
            'Account lockout after 10 consecutive failed login attempts (auto-resets after 30 minutes)',
            'Role-based access control: household members can only access their own household\'s data',
            'HTTP security headers including Content-Security-Policy, X-Frame-Options, and HSTS',
            'Automated static analysis (Brakeman) and dependency vulnerability scanning (bundler-audit) in CI/CD',
          ]} />
          <P>
            No system is completely secure. If you discover a vulnerability, please report it
            responsibly to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sky-600 dark:text-sky-400 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </P>
        </Section>

        <Section id="cookies" title="10. Cookies &amp; Local Storage">
          <P>
            CatCare does <strong>not</strong> use cookies for session management or tracking.
          </P>
          <P>
            We use your browser's <strong>localStorage</strong> to store:
          </P>
          <Ul items={[
            'Your authentication token (required to keep you signed in)',
            'Your active household ID and basic profile (avoids repeated API calls)',
            'Your theme preference (light / dark / system)',
            'Your notification preferences',
            'Dashboard chart layout preferences',
          ]} />
          <P>
            This data is stored locally on your device and is not transmitted to third parties.
            It is cleared when you sign out or delete your account. There are no third-party tracking
            or advertising cookies.
          </P>
        </Section>

        <Section id="children" title="11. Children">
          <P>
            CatCare is not directed at children under 16. We do not knowingly collect personal data
            from anyone under 16. If you believe we have inadvertently collected data from a child,
            please contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sky-600 dark:text-sky-400 hover:underline">
              {CONTACT_EMAIL}
            </a>{' '}
            and we will delete it promptly.
          </P>
        </Section>

        <Section id="changes" title="12. Changes to This Policy">
          <P>
            We may update this policy from time to time. When we make material changes (changes that
            affect your rights or how we process your data), we will:
          </P>
          <Ul items={[
            'Update the "Effective date" at the top of this page',
            'Notify you by email at least 14 days before the changes take effect',
            'Display an in-app notice on your next login',
          ]} />
          <P>
            Continuing to use CatCare after the notice period constitutes acceptance of the revised
            policy. You may delete your account at any time if you do not agree to the changes.
          </P>
        </Section>

        <Section id="contact" title="13. Contact &amp; Complaints">
          <P>
            For any privacy-related questions, requests to exercise your rights, or concerns, please
            contact us:
          </P>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-1 text-sm">
            <p className="font-medium text-slate-800 dark:text-slate-200">CatCare Privacy</p>
            <p>
              Email:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-sky-600 dark:text-sky-400 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
          <P>
            If you are located in the EEA or UK and are not satisfied with our response, you have
            the right to lodge a complaint with your local data protection authority:
          </P>
          <Ul items={[
            'United Kingdom: Information Commissioner\'s Office (ico.org.uk)',
            'European Union: your national supervisory authority (edpb.europa.eu/about-edpb/about-edpb/members)',
          ]} />
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Cat className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="font-semibold text-sm tracking-tight">CatCare</span>
          </div>
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} CatCare. Made for cat people.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
