import type { SupabaseClient } from '@supabase/supabase-js';
import { CostApiError } from './jobCostAccess';

/** Password creation is a separate flow from accepting with an existing login. */
export async function resolveInvitationAccount(
  db: Pick<SupabaseClient, 'auth'>,
  input: { email: string; password?: string; authorization?: string },
): Promise<{ userId: string; created: boolean }> {
  if (input.password !== undefined) {
    // A browser may still hold the owner's (or another employee's) session.
    // The invitation, not that unrelated session, determines the new account.
    const { data, error } = await db.auth.admin.createUser({
      email: input.email, password: input.password, email_confirm: true,
    });
    if (error || !data.user) throw new CostApiError(409, 'An account may already exist. Sign in with your existing email and password, then accept the invitation.');
    return { userId: data.user.id, created: true };
  }
  if (!input.authorization?.startsWith('Bearer '))
    throw new CostApiError(400, 'Enter a password of at least 12 characters, or sign in to your existing account.');
  const { data, error } = await db.auth.getUser(input.authorization.slice(7));
  if (error || !data.user || data.user.email?.trim().toLowerCase() !== input.email.trim().toLowerCase())
    throw new CostApiError(403, 'Sign in with the email address this invitation was sent to.');
  return { userId: data.user.id, created: false };
}
