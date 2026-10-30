/**
 * Serialise structured data for a `<script type="application/ld+json">`.
 *
 * JSON.stringify leaves `<` alone, so a string containing `</script>` closes
 * the tag and whatever follows is parsed as HTML. Blog posts carry
 * CMS-authored titles and descriptions into this, so `<` is escaped to its
 * unicode form — still valid JSON, and the parsed value is unchanged. `>` and
 * `&` go too so no reader can mistake the payload for markup.
 *
 * The browser never executes a JSON-LD block, which is why the CSP in
 * proxy.ts lets it through without a nonce.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
