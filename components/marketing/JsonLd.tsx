import { serializeJsonLd } from '@/lib/utils/json-ld';

/** Structured data for crawlers. Build the payload with lib/marketing/schema.ts. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
