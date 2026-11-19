import { redirect } from 'next/navigation';

// The order rules moved onto the Orders page (Edit orders), beside the list they shape.
// The old address, from bookmarks and help links, lands there.
export default function OrdersConfigurationPage() {
  redirect('/orders?edit=1');
}
