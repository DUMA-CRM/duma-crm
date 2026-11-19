/** Better Auth signs this query and verifies it again when the flow resumes. */
export function chatgptOAuthQuery(search: string): string | undefined {
  const query = new URLSearchParams(search);
  if (query.get('response_type') !== 'code' || !query.get('client_id') || !query.get('sig')) return undefined;
  query.delete('error');
  return query.toString();
}

export function chatgptOAuthDestination(value: string | undefined, origin: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.origin === origin && url.pathname === '/connect/chatgpt') return url.href;
    if (url.origin === 'https://chatgpt.com' &&
        (url.pathname === '/connector_platform_oauth_redirect' || /^\/connector\/oauth\/[a-zA-Z0-9_-]+$/.test(url.pathname))) {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}
