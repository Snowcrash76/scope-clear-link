/** Public client pages use a separate capability, never a job ID as a key. */
export function clientAccessHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const quote = window.location.pathname.match(/^\/quote\/([^/]+)/)?.[1];
  if (quote) return { 'X-Client-Quote-Token': decodeURIComponent(quote) };
  if (/^\/project\//.test(window.location.pathname)) {
    const token = new URLSearchParams(window.location.search).get('access');
    return token ? { 'X-Client-Project-Token': token } : {};
  }
  return {};
}
export function isClientPage() {
  return typeof window !== 'undefined' && /^\/(project|quote)\//.test(window.location.pathname);
}
/** Retains the existing Supabase hook interfaces while routing client data
 * through the server's token-validated, project-scoped gateway. Auth and signed
 * uploads still go directly to Supabase; service credentials never reach here. */
export async function clientScopedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const rest = url.pathname.match(/^\/rest\/v1\/(.+)$/);
  if (rest && isClientPage()) {
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    // The gateway authenticates the capability, not the browser's anon JWT.
    headers.delete('apikey'); headers.delete('Authorization');
    for (const [key, value] of Object.entries(clientAccessHeaders())) headers.set(key, value);
    return fetch(`/api/client/data/${rest[1]}${url.search}`, { ...init, headers });
  }
  return fetch(input, init);
}
