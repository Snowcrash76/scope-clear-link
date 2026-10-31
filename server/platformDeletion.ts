import type { SupabaseClient } from '@supabase/supabase-js';
import { configuredAdminEmail, missingPlatformObject, PlatformError } from './platformAccess';

export const deletionSetupMessage = 'History-preserving deletion needs its approved Supabase setup before it can be used. Existing access controls are unaffected.';
export async function deletionReady(db: SupabaseClient) {
  const { error } = await db.from('platform_controls').select('deleted_at').limit(1);
  if (missingPlatformObject(error) || ['42703', 'PGRST204'].includes(error?.code)) return false;
  if (error) throw new PlatformError(503, 'Deletion setup could not be verified.');
  return true;
}
function check(error: any) {
  if (error) throw new PlatformError(error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : 503,
    error.code === 'P0001' ? error.message : 'Deletion could not be confirmed. Refresh the directory to check the current access state before retrying.');
}
export async function deletePlatformIdentity(db: SupabaseClient, actorId: string, kind: 'account' | 'business', targetId: string, input: { reason: string; confirmation: string }) {
  if (!await deletionReady(db)) throw new PlatformError(503, deletionSetupMessage);
  const { data, error } = await db.rpc('platform_prepare_deletion', {
    p_actor: actorId, p_admin_email: configuredAdminEmail(), p_kind: kind, p_target: targetId,
    p_reason: input.reason, p_confirmation: input.confirmation,
  });
  check(error);
  if (!data.completed) {
    let deleted = data.authDeleted === true;
    if (!deleted) {
      try {
        // Soft-delete the Auth identity. A hard delete would cascade and erase
        // owned jobs/profiles, contrary to the user's explicit history policy.
        const result = await db.auth.admin.deleteUser(targetId, true);
        deleted = !result.error;
      } catch { /* Keep access blocked and mark the attempt retryable. */ }
    }
    const { data: finished, error: finishError } = await db.rpc('platform_finish_deletion', {
      p_actor: actorId, p_admin_email: configuredAdminEmail(), p_target: targetId, p_event: data.eventId, p_success: deleted,
    });
    check(finishError);
    if (!finished) throw new PlatformError(502, 'Access was removed, but login deletion is not yet confirmed. Retry deletion. Job and financial history is retained.');
  }
  return { success: true, message: kind === 'business'
    ? 'Business deleted from active administration and access removed. Job, invoice and staff history is retained. Other staff login accounts were not deleted.'
    : 'Login account deleted. Job and financial history is retained. This does not erase owned business records.' };
}
