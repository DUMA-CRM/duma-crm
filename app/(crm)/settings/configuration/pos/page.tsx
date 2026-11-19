import { redirect } from 'next/navigation';

// Till settings moved onto the till itself (Edit till → Till settings), where the keys are their own preview.
// The old address, from bookmarks and help links, lands there.
export default function PosConfigurationPage() {
  redirect('/pos?edit=1');
}
