import { redirect } from 'next/navigation';

/** /menu has no content of its own — the sections are the real routes. */
export default function MenuPage() {
  redirect('/menu/items');
}
