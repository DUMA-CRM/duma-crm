import { StaffWorkspace } from '@/components/people/StaffWorkspace';

/** `?ticket=<id>` opens that ticket — how the employee record links a request. */
export default async function StaffHelpdeskPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { ticket } = await searchParams;
  return <StaffWorkspace tab="helpdesk" initialTicket={typeof ticket === 'string' ? ticket : null} />;
}
