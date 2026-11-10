import '../(marketing)/marketing.css';

/**
 * Full-screen frame for the sign-up questionnaire. Deliberately not the (auth)
 * split layout: one question per screen needs the whole width to breathe, and
 * the flow draws its own header with progress.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // The marketing paper, without the curves: the questions fill the width.
  return <div className="mkt min-h-dvh">{children}</div>;
}
