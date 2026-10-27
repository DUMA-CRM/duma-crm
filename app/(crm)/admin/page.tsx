import { redirect } from 'next/navigation';

// Overview lives at its own path so the sidebar marks only it, not every
// /admin/* page, as current.
export default function AdminIndexPage() {
  redirect('/admin/overview');
}
