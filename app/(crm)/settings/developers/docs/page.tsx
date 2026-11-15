import { permanentRedirect } from 'next/navigation';

/** The API reference moved to the public developer docs; old links land there. */
export default function SettingsDevelopersDocsPage() {
  permanentRedirect('/developers');
}
