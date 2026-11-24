import { redirect } from 'next/navigation';

/** My rota is the Rota tab of My work. The team rota is a tab of Staff. */
export default function MyRotaRedirect() {
  redirect('/my-work?tab=rota');
}
