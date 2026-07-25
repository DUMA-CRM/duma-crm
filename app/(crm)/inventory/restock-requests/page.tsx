import { redirect } from 'next/navigation';

export default function RestockRequestsRedirect() {
  redirect('/inventory/purchasing');
}
