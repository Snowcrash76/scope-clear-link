import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';
import { CostApiError } from './jobCostAccess';

export class PlatformError extends CostApiError {
  constructor(status: number, message: string) { super(status, message); }
}
export const setupMessage = 'System administration security setup is pending. Apply the approved platform administration migration before using account controls.';
export const platformBuild = 'platform-administration-20261101';
export const releaseMessage = 'Publish this application build before using system account controls. The published server must enforce the same business restrictions as this preview.';
export const missingPlatformObject = (error: any) => ['42883', '42P01', 'PGRST202', 'PGRST205'].includes(error?.code);

/** Only a completely absent feature may retain the pre-migration behaviour. */
export async function platformReady(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from('platform_controls').select('target_id').limit(1);
  if (missingPlatformObject(error)) return false;
  if (error) throw new PlatformError(503, 'Unable to verify system access controls.');
  return true;
}
/** Never let preview controls restrict users while an older published API bypasses those controls. */
export async function platformReleaseReady(send: typeof fetch = fetch, deployment = process.env.REPLIT_DEPLOYMENT): Promise<boolean> {
  // Replit sets this only on the published runtime. A production request is
  // already executing this build; fetching its own public URL can queue behind
  // itself on autoscale and falsely disable every administrator action.
  if (deployment === '1') return true;
  try {
    const origin = new URL(process.env.VITE_PUBLIC_BASE_URL || '');
    if (origin.protocol !== 'https:') return false;
    const response = await send(new URL('/api/platform/version', origin), { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) return false;
    return (await response.json()).build === platformBuild;
  } catch { return false; }
}
export async function assertPlatformAccess(db: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await db.rpc('platform_check_access', { p_user: userId });
  if (missingPlatformObject(error) && !await platformReady(db)) return;
  if (error) throw new PlatformError(503, 'System access checks are unavailable. Please retry later.');
  if (data !== true) throw new PlatformError(403, 'This account or business has been restricted by the system administrator. Contact support.');
}
export async function assertPlatformBusinessAccess(db: SupabaseClient, ownerId: string): Promise<void> {
  const { data, error } = await db.rpc('platform_check_business', { p_owner: ownerId });
  if (missingPlatformObject(error) && !await platformReady(db)) return;
  if (error) throw new PlatformError(503, 'Business access checks are unavailable.');
  if (data !== true) throw new PlatformError(403, 'This business is currently restricted. Contact the system administrator.');
}
export function configuredAdminEmail() {
  return (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
}
export async function requirePlatformAdmin(db: SupabaseClient, authorization?: string) {
  if (!authorization?.startsWith('Bearer ')) throw new PlatformError(401, 'Sign in required.');
  const { data: { user }, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !user?.email) throw new PlatformError(401, 'Sign in required.');
  if (!configuredAdminEmail() || user.email.trim().toLowerCase() !== configuredAdminEmail())
    throw new PlatformError(403, 'System administrator access required.');
  return user;
}
/** All bearer-authenticated APIs share the same access check, not only admin routes. */
export function platformApiFence(client: () => SupabaseClient): RequestHandler {
  return async (req, res, next) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) return next();
    try {
      const db = client();
      const { data: { user }, error } = await db.auth.getUser(req.headers.authorization.slice(7));
      if (error || !user) return res.status(401).json({ error: 'Sign in required.' });
      await assertPlatformAccess(db, user.id);
      next();
    } catch (error) {
      return res.status(error instanceof PlatformError ? error.status : 503).json({
        error: error instanceof PlatformError ? error.message : 'System access checks are unavailable.',
      });
    }
  };
}
