import { StaffWorkspace } from '@/components/people/StaffWorkspace';

/** The team directory. It moved off `/staff` when the overview took the root. */
export default function StaffTeamPage() {
  return <StaffWorkspace tab="team" />;
}
