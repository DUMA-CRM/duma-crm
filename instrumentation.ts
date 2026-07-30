import type { Instrumentation } from 'next';

export function register() {}

/**
 * Provider-neutral server error hook. Set ERROR_REPORTING_URL to a webhook or
 * ingestion endpoint in production. Deliberately excludes headers, query
 * strings, request bodies, and error messages because DUMA handles sensitive
 * customer and employee data.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  const reportedError = error instanceof Error ? error : new Error('Unknown server error');
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error && typeof error.digest === 'string'
      ? error.digest
      : undefined;
  const endpoint = process.env.ERROR_REPORTING_URL;
  if (!endpoint) {
    console.error('Unhandled server error', {
      digest,
      routePath: context.routePath,
      routeType: context.routeType,
    });
    return;
  }

  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'duma-crm-server',
      digest,
      name: reportedError.name,
      routePath: context.routePath,
      routeType: context.routeType,
      runtime: process.env.NEXT_RUNTIME,
    }),
  }).catch(() => {});
};
