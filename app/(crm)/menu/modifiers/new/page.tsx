import { redirect } from 'next/navigation';

/** New modifiers are a drawer on the Modifiers list now — keep old links working. */
export default function NewModifierPage() {
  redirect('/menu/modifiers?new=1');
}
