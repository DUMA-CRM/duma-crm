import type { Metadata } from 'next';

import { LegalDocument } from '../LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How DUMA collects, uses and protects personal data.',
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated="10 October 2026">
      <p>
        DUMA is a business operating system for hospitality — till, kitchen display, stock, people, customer records,
        reporting and guest QR ordering. This policy explains what personal data we handle, why, and the choices you have.
      </p>

      <h2>Who we are and our role</h2>
      <p>
        For the data a business puts into its DUMA workspace — its staff, customers, orders and notes — that business is
        the <strong>controller</strong> and DUMA acts as its <strong>processor</strong>, handling the data only on the
        business&apos;s instructions. For account holders&apos; own sign-in details and our service emails, DUMA is the
        controller.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — name, email address, role, workspace and location. Passwords are stored only as
          a one-way hash.
        </li>
        <li>
          <strong>Staff data</strong> entered by the business — contact details, date of birth, home address, emergency
          contact, shifts, timesheets, leave and absence, pay rate, tax code, National Insurance number and bank details,
          payslips, and employment documents such as right-to-work checks, contracts and fit notes.
        </li>
        <li>
          <strong>Customer data</strong> entered by the business — name, phone, email, date of birth, addresses, order
          history, loyalty points and tier, referral codes, marketing consent, seating preferences and notes. A business
          may also record <strong>allergies and dietary needs</strong>, which can reveal health information.
        </li>
        <li>
          <strong>Guest ordering data</strong> — a guest ordering by QR code gives a name, a collection time, a payment
          method and the items ordered, and may choose to give an email address to link the order to a loyalty account.
          Guests do not need an account.
        </li>
        <li>
          <strong>Payment data</strong> — card payments are taken by our payment providers. DUMA receives the outcome and
          a reference, never the card number.
        </li>
        <li>
          <strong>Technical data</strong> — the session cookie that keeps you signed in, and the IP address and browser
          details recorded with sign-ins and in the audit log.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the service: take orders and payments, run the kitchen, manage stock, staff and customers.</li>
        <li>To keep accounts secure, keep an audit trail, investigate faults and prevent misuse.</li>
        <li>To send service emails such as password resets and sign-in links.</li>
        <li>To meet legal and accounting obligations.</li>
      </ul>
      <p>
        Our lawful bases are performance of a contract, our legitimate interest in running a secure and reliable service,
        and legal obligation. Where a business records health information such as allergies or fit notes, it is
        responsible for having a condition for processing that special category data. We do not sell personal data and
        we do not use it for advertising.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We use one strictly necessary cookie — the session cookie that signs you in. We do not use analytics,
        advertising or cross-site tracking cookies, and a guest ordering by QR code is not given a cookie. The app stores
        your display preferences in your browser&apos;s local storage, and on staff devices it keeps the data the till
        needs to work offline, including sales waiting to be sent.
      </p>

      <h2>Who we share it with</h2>
      <p>We use a small number of service providers, each processing data only to provide the service:</p>
      <ul>
        <li>Vercel, which hosts the web app and stores images added to notes and email templates.</li>
        <li>
          A virtual private server provider, which hosts our application server and database. Encrypted backups are
          stored with GitHub.
        </li>
        <li>Stripe, SumUp and Square, for card payments, when the business has connected them.</li>
        <li>The email provider each business connects to send emails to its own customers and staff, and our own email provider for account emails.</li>
        <li>Google Drive, only when a user chooses to connect their own Drive to Notes, limited to files DUMA creates.</li>
        <li>
          AI model providers — Google Gemini, and models reached through OpenRouter — for the Ask DUMA assistant and
          content tools. They receive the request a user makes and the data needed to answer it. Some of these models
          are offered free of charge and their providers may retain or use prompts, so do not include personal data in
          an assistant request unless it is needed.
        </li>
        <li>A storage bucket (for example Amazon S3 or Cloudflare R2), only if a business connects its own for website assets.</li>
      </ul>
      <p>We may also disclose data where the law requires it.</p>

      <h2>International transfers</h2>
      <p>
        Some providers process data outside the UK and EEA. Where they do, we rely on adequacy decisions or standard
        contractual clauses.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Workspace data is kept while the business uses DUMA. Businesses can export customer data and orders, handle
        access and erasure requests from their customers, and anonymise former employees after their retention period.
        When a customer&apos;s data is erased, their record is anonymised and the order history is kept without their
        identity, because financial records must be retained. Some records, such as audit logs and copies of sent
        emails, are not yet removed by erasure; we are working to close that gap.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. National Insurance numbers, bank account details, payment provider credentials,
        email server passwords and connected-account tokens are encrypted at rest. Access within a workspace is limited
        by the permissions each business assigns to its staff, and important actions are recorded in an audit log.
      </p>

      <h2>Your rights</h2>
      <p>
        Under UK and EU data protection law you can ask to access, correct, delete, restrict or port your data, and
        object to how it is used. If your data was entered by a business that uses DUMA — as a member of its staff, as
        its customer or as a guest ordering by QR code — please contact that business first; we will help them respond.
        You can also complain to the Information Commissioner&apos;s Office (<a href="https://ico.org.uk">ico.org.uk</a>)
        or your local supervisory authority.
      </p>

      <h2>Changes</h2>
      <p>We will post any changes on this page and update the date above. Significant changes will be notified in the app.</p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or your data: <a href="mailto:dudychmarian@gmail.com">dudychmarian@gmail.com</a>.
      </p>
    </LegalDocument>
  );
}
