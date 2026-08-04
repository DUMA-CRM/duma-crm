import { redirect } from 'next/navigation';

/** The shift register merged into the rota — one page for planned and worked time. */
export default function StaffShiftsRedirect() {
  redirect('/staff/rota');
}
