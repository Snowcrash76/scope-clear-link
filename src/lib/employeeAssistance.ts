export const isEmployeeMemberId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Preserve invalid targets as a context too: they must fail closed, not show the owner's data. */
export function assistanceMemberFromPath(pathname: string): string | null {
  const match = /^\/team\/assist\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

export function employeeAssistanceHref(memberId: string | null, path: string): string {
  if (!memberId) return path;
  const root = `/team/assist/${encodeURIComponent(memberId)}`;
  if (/^\/employee(?:\/|[?#]|$)/.test(path)) return root + path.slice('/employee'.length);
  if (/^\/schedule(?:[?#]|$)/.test(path)) return root + '/schedule' + path.slice('/schedule'.length);
  return path;
}
