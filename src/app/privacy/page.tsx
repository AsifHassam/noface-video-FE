import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | noface.video",
  description:
    "How noface.video collects, uses, and protects your information when you use our faceless video creation service.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/70 to-muted" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_55%)]" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <header className="mb-10 space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 25, 2026
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This policy describes how noface.video (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
            handles personal information when you use our website and services at{" "}
            <span className="text-foreground">noface.video</span> (the &quot;Service&quot;).
          </p>
        </header>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              1. Information we collect
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Account data.</strong> When you sign in, we
                collect your email address and account identifiers provided by our authentication
                provider.
              </li>
              <li>
                <strong className="text-foreground">Content and usage.</strong> We process scripts,
                project settings, media you upload (such as images for characters or backgrounds),
                generated videos, and related metadata needed to operate the Service.
              </li>
              <li>
                <strong className="text-foreground">Technical data.</strong> We may collect IP
                address, device and browser type, and general usage logs for security, debugging,
                and improving reliability.
              </li>
              <li>
                <strong className="text-foreground">Integrations you enable.</strong> If you connect
                third-party services (for example Instagram or other social platforms), we receive
                tokens and profile identifiers as required to perform the actions you request. Those
                providers process data under their own policies.
              </li>
              <li>
                <strong className="text-foreground">Payment data.</strong> Payments are handled by
                our payment processor. We do not store full card numbers on our servers; we may
                receive limited billing metadata (such as subscription status and transaction
                references).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              2. How we use information
            </h2>
            <p>We use the information above to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide, operate, and improve the Service (including rendering and hosting videos)</li>
              <li>Authenticate you and secure your account</li>
              <li>Process subscriptions and credits</li>
              <li>Run automation features you configure (for example scheduled posting)</li>
              <li>Communicate about the Service (such as transactional emails)</li>
              <li>Comply with law and enforce our terms</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              3. Sharing and subprocessors
            </h2>
            <p>
              We share information with service providers who help us run the Service (for example
              cloud hosting, databases, authentication, email delivery, video rendering, analytics,
              and payment processing). They may only use data as instructed to perform services for
              us. We may also disclose information if required by law or to protect rights and
              safety.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              4. Retention
            </h2>
            <p>
              We keep information for as long as your account is active and as needed to provide the
              Service, comply with legal obligations, resolve disputes, and enforce agreements.
              You may request deletion of your account subject to applicable law and legitimate
              business needs (such as billing records).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              5. Security
            </h2>
            <p>
              We use administrative, technical, and organizational measures designed to protect
              personal information. No method of transmission or storage is completely secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              6. Your choices and rights
            </h2>
            <p>
              Depending on where you live, you may have rights to access, correct, delete, or export
              your personal information, or to object to or restrict certain processing. To exercise
              these rights, contact us using the details below. You may also disconnect linked
              integrations from within the Service where supported.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              7. International transfers
            </h2>
            <p>
              We may process and store information in countries other than your own. Where we
              transfer personal data across borders, we take steps consistent with applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              8. Children
            </h2>
            <p>
              The Service is not directed at children under 13 (or the minimum age in your
              jurisdiction). We do not knowingly collect personal information from children.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              9. Changes
            </h2>
            <p>
              We may update this policy from time to time. We will post the updated version on this
              page and revise the &quot;Last updated&quot; date.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              10. Contact
            </h2>
            <p>
              For privacy questions or requests, email{" "}
              <a
                href="mailto:support@noface.video"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                support@noface.video
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
