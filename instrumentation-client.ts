const endpoint = process.env.NEXT_PUBLIC_ERROR_REPORTING_URL;
const reported = new Set<string>();

function report(error: unknown, source: 'error' | 'unhandledrejection') {
  if (!endpoint) return;
  const name = error instanceof Error ? error.name : 'UnknownError';
  const fingerprint = `${source}:${name}:${window.location.pathname}`;
  if (reported.has(fingerprint) || reported.size >= 20) return;
  reported.add(fingerprint);

  const payload = JSON.stringify({
    source: 'duma-crm-client',
    kind: source,
    name,
    path: window.location.pathname,
  });
  navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
}

try {
  window.addEventListener('error', (event) => report(event.error, 'error'));
  window.addEventListener('unhandledrejection', (event) => report(event.reason, 'unhandledrejection'));
} catch {
  // Monitoring must never prevent application startup.
}
