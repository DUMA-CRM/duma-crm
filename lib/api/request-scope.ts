/**
 * The context headers apiFetch adds to a browser request. The workspace store
 * registers the provider; until it does (the guest app, the sign-in page) a
 * request carries no context at all, which is correct for both.
 *
 * Kept apart from the store so the API client never imports React state.
 */
type ScopeProvider = () => Record<string, string>;

let provider: ScopeProvider | null = null;

export function registerRequestScope(next: ScopeProvider) {
  provider = next;
}

export function requestScopeHeaders(): Record<string, string> {
  if (typeof window === 'undefined' || !provider) return {};
  return provider();
}
