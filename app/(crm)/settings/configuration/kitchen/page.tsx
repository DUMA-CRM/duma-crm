import { redirect } from 'next/navigation';

// Kitchen screen settings moved onto the screen itself (Edit kitchen screen), where the board is their preview.
// The old address, from bookmarks and help links, lands there.
export default function KitchenConfigurationPage() {
  redirect('/kds?edit=1');
}
