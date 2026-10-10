import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDocument } from '../LegalDocument';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern use of DUMA.',
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" updated="10 October 2026">
      <p>
        These terms govern your use of DUMA — the back office, till, kitchen display and guest ordering services
        (together, the &ldquo;Service&rdquo;). By creating a workspace or using the Service you agree to them. If you
        accept on behalf of a business, you confirm you have authority to bind it.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>You must give accurate information and keep your sign-in details confidential.</li>
        <li>
          The workspace owner is responsible for who they invite, the permissions they grant, and everything done under
          their workspace.
        </li>
        <li>Tell us promptly at <a href="mailto:dudychmarian@gmail.com">dudychmarian@gmail.com</a> if you suspect unauthorised access.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>break the law or infringe anyone&apos;s rights through the Service;</li>
        <li>attempt to access data or workspaces you are not authorised to see;</li>
        <li>probe, overload or disrupt the Service, or bypass its security or usage limits;</li>
        <li>upload malicious code, or reverse engineer the Service except where the law allows.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        You keep all rights to the data you put into DUMA. You grant us the permission we need to host and process it to
        provide the Service. You are responsible for having a lawful basis for the personal data you enter about staff
        and customers. How we handle personal data is set out in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Payments and orders</h2>
      <p>
        Card payments are processed by the provider you connect — Stripe, SumUp or Square — under that provider&apos;s
        own terms, and payments go directly to your account with them. You remain responsible for your prices, tax and
        VAT treatment, refunds, receipts and the accuracy of your financial records. Figures DUMA calculates — including
        margins and reports — are tools to help you, not accounting or tax advice.
      </p>

      <h2>AI features</h2>
      <p>
        Ask DUMA and other AI-assisted tools can be wrong. Check their output before relying on it, especially for
        anything touching money, stock, staff or customers. Requests are sent to third-party model providers, as
        described in the Privacy Policy.
      </p>

      <h2>Fees</h2>
      <p>
        DUMA is currently provided without charge. If we introduce paid plans, we will give notice and you will not be
        charged unless you choose to subscribe.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep the Service available and secure but do not promise it will be uninterrupted or error-free. The
        till keeps taking cash sales offline and sends them when the connection returns; card payments need a
        connection. We may improve, change or retire features, and will give notice of changes that materially reduce
        what you rely on.
      </p>

      <h2>Suspension and termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or end access for serious or repeated breach of these
        terms, or to protect the Service or other users. When a workspace closes, you can ask us to export or delete
        your data, subject to records that must be kept by law.
      </p>

      <h2>Liability</h2>
      <p>
        Nothing in these terms limits liability that cannot be limited by law, including for death or personal injury
        caused by negligence, or for fraud. Otherwise, we are not liable for indirect or consequential loss, or loss of
        profit, revenue or data, and our total liability in any twelve months is limited to the greater of the fees you paid
        us in that period and £100. If you use the Service as a consumer, your statutory rights are not affected.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. We will post the new version here and update the date above; for significant changes
        we will tell you in the app first. Continuing to use the Service after a change takes effect means you accept it.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of England and Wales, and its courts have jurisdiction.</p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:dudychmarian@gmail.com">dudychmarian@gmail.com</a>
      </p>
    </LegalDocument>
  );
}
