/** Page paths, query strings and fragments are never part of an app origin. */
export function publicWebOrigin(configured: string): string {
  const url = new URL(configured.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Configure a public HTTP(S) website address without credentials.');
  return url.origin;
}
