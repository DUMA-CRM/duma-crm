import { SharedAgreement } from './shared-agreement';

export const metadata = {
  title: 'Shared agreement',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
} as const;

export default function SharedAgreementPage() {
  return <SharedAgreement />;
}
