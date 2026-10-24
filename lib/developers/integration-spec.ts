import { PUBLIC_APIS } from './api-reference.ts';

type Json = undefined | null | boolean | number | string | Json[] | { [key: string]: Json };
type ObjectValue = { [key: string]: Json };
const object = (value: Json | undefined): ObjectValue => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

/** Allowlist operations, then retain only their reachable component definitions. */
export function integrationSpec(source: ObjectValue, origin: string) {
  const paths: ObjectValue = {};
  const sourcePaths = object(source.paths);
  for (const api of PUBLIC_APIS)
    for (const endpoint of api.endpoints) {
      const path = `${api.basePath}${endpoint.path}`;
      const item = object(sourcePaths[path]);
      const method = endpoint.method.toLowerCase();
      if (!item[method]) throw new Error(`Missing integration operation: ${method} ${path}`);
      const tag =
        api.id === 'management'
          ? ({
              content: 'CMS authoring',
              media: 'Media',
              notes: 'Notes',
              catalog: 'Catalogue',
              locations: 'Locations',
              workspace: 'Workspace',
            }[endpoint.scope?.split(':')[0] ?? ''] ?? 'Workspace')
          : api.id === 'manage'
            ? 'CMS draft creation (original API)'
            : api.name;
      const operation = {
        ...object(item[method]),
        tags: [tag],
        security: endpoint.scope ? [{ WorkspaceKey: [] }] : [],
        'x-scopes': endpoint.scope ? [endpoint.scope] : [],
        description: [
          object(item[method]).description,
          endpoint.scope ? `Required scope: \`${endpoint.scope}\`.` : '',
          endpoint.method === 'DELETE' ? 'Deletes data. Review the target resource before sending this request.' : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      };
      paths[path] = { ...object(paths[path]), ...(item.parameters ? { parameters: item.parameters } : {}), [method]: operation };
    }
  const components: ObjectValue = {
    securitySchemes: {
      WorkspaceKey: {
        type: 'http',
        scheme: 'bearer',
        description: 'Workspace API key (dk_pub_… or dk_sec_…). Management operations require a secret key.',
      },
    },
  };
  const seen = new Set<string>();
  const visit = (value: Json): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value.$ref === 'string') {
      const ref = value.$ref;
      if (!ref.startsWith('#/components/')) throw new Error(`Unexpected integration reference: ${ref}`);
      if (!seen.has(ref)) {
        seen.add(ref);
        const [, , group, name] = ref.split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
        const definition = object(object(source.components)[group!])[name!];
        if (definition === undefined) throw new Error(`Missing component: ${ref}`);
        components[group!] = { ...object(components[group!]), [name!]: definition };
        visit(definition);
      }
    }
    Object.values(value).forEach(visit);
  };
  visit(paths);
  return {
    openapi: source.openapi ?? '3.1.0',
    info: {
      title: 'DUMA integration API',
      version: object(source.info).version ?? '1.0.0',
      description:
        'Use a workspace API key to integrate with DUMA. Management permissions are limited by the key creator’s current access. CMS updates require the version read from the entry; publishing and deletion require separate scopes.',
    },
    servers: [{ url: origin.replace(/\/$/, ''), description: 'Configured DUMA API' }],
    paths,
    components,
  };
}
