type JsonObject = Record<string, unknown>;

/**
 * Gemini accepts `type: ["string", "null"]` for an argument the model may skip.
 * Not every OpenAI-compatible router does — several reject union types outright
 * and would fail the whole tool list — so for a fallback provider the union
 * collapses to its real type and the key leaves `required` instead.
 *
 * That is a faithful translation rather than a loosening: the tools already
 * treat a missing argument and an explicit null the same way.
 */
export function relaxSchema(schema: JsonObject): JsonObject {
  const properties = schema.properties as Record<string, JsonObject> | undefined;
  if (!properties) return schema;

  const nullable = new Set<string>();
  const relaxed: Record<string, JsonObject> = {};
  for (const [key, property] of Object.entries(properties)) {
    if (Array.isArray(property.type)) {
      const types = property.type as string[];
      if (types.includes('null')) nullable.add(key);
      relaxed[key] = { ...property, type: types.find((entry) => entry !== 'null') ?? 'string' };
    } else if (property.type === 'array' && property.items && typeof property.items === 'object') {
      relaxed[key] = { ...property, items: relaxSchema(property.items as JsonObject) };
    } else if (property.type === 'object') {
      relaxed[key] = relaxSchema(property);
    } else {
      relaxed[key] = property;
    }
  }

  const required = Array.isArray(schema.required) ? (schema.required as string[]).filter((key) => !nullable.has(key)) : undefined;
  return { ...schema, properties: relaxed, ...(required ? { required } : {}) };
}
