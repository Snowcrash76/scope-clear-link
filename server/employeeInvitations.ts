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
    if (error || !data.user) {
      const code = error?.code;
      if (['email_exists', 'user_already_exists'].includes(code ?? '') ||
        (error?.status === 422 && /email.*already.*(?:registered|exists)|already.*registered/i.test(error.message))) {
        throw new CostApiError(409, 'This email already has an account. Use “I already have an account” and its existing password, or request a password reset.', 'ACCOUNT_EXISTS');
      }
      console.warn('[employee-invitation] account creation failed', { status: error?.status ?? null, code: code ?? 'unknown' });
      if (code === 'weak_password') throw new CostApiError(400, 'Choose a stronger password with at least 12 characters. This password was not accepted.', 'WEAK_PASSWORD');
      if (error?.status === 429) throw new CostApiError(429, 'Account setup is temporarily rate limited. Wait a moment and try again.', 'AUTH_RATE_LIMIT');
      throw new CostApiError(503, 'Employee account creation is temporarily unavailable. Please retry; this does not mean an account already exists.', 'ACCOUNT_SETUP_UNAVAILABLE');
    }
    return { userId: data.user.id, created: true };
  }
  if (!input.authorization?.startsWith('Bearer '))
    throw new CostApiError(400, 'Enter a password of at least 12 characters, or sign in to your existing account.');
  const { data, error } = await db.auth.getUser(input.authorization.slice(7));
  if (error || !data.user || data.user.email?.trim().toLowerCase() !== input.email.trim().toLowerCase())
    throw new CostApiError(403, 'Sign in with the email address this invitation was sent to.');
  return { userId: data.user.id, created: false };
}

/** Keep the RPC's authoritative eligibility checks, but explain the common
 * existing-business-account conflict before asking it to mutate anything. */
export async function assertInvitationAccountEligible(
  db: SupabaseClient, userId: string, ownerId?: string,
) {
  if (ownerId === userId) throw new CostApiError(409,
    'This is the business-owner account. Keep it as your owner login and use a different email for an employee account.', 'BUSINESS_OWNER_ACCOUNT');
  const [jobs, staff] = await Promise.all([
    db.from('projects').select('id').eq('user_id', userId).limit(1),
    db.from('employees').select('id').eq('owner_id', userId).limit(1),
  ]);
  if (jobs.error || staff.error) throw new CostApiError(503,
    'We could not check account eligibility. Please retry without changing the invitation.', 'ACCOUNT_CHECK_UNAVAILABLE');
  if (jobs.data?.length || staff.data?.length) throw new CostApiError(409,
    'This email already owns a business account with jobs or team members. It cannot be converted to employee access without affecting that account. Ask your employer to invite a different email; your existing jobs have not been changed.', 'BUSINESS_OWNER_ACCOUNT');
}

/** A prepared link remains useful even when provider delivery fails or is
 * uncertain. Never log its token, recipient, request body or provider body. */
export async function deliverEmployeeInvitation(
  input: { email: string; url: string; from: string; key: string; idempotencyKey: string },
  send: typeof fetch = fetch,
) {
  let result: Response;
  try {
    result = await send('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${input.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify({
        from: input.from, to: [input.email], subject: 'You are invited to the ScopeStream employee portal',
        text: `You have been invited to your employer's ScopeStream employee portal.\n\nAccept your invitation: ${input.url}\n\nThis invitation expires in 7 days. Use the most recent invitation if several were sent. If you already have an account, sign in with its existing password. If you were not expecting this email, you can ignore it.`,
      }),
    });
  } catch {
    console.warn('[employee-invitation] email delivery unconfirmed');
    throw new CostApiError(502, 'The invitation is ready, but email delivery could not be confirmed. Copy its link below rather than repeatedly resending.',
      'INVITATION_EMAIL_UNCONFIRMED', { invitation_url: input.url, delivery: 'unknown' });
  }
  if (!result.ok) {
    console.warn('[employee-invitation] email rejected', { status: result.status });
    const reason = result.status === 429 ? 'The email provider rate limit was reached.'
      : [401, 403].includes(result.status) ? 'The email provider rejected the sender configuration.' : 'The email provider could not accept the message.';
    throw new CostApiError(502, `${reason} The invitation is ready; copy its link below to send it directly.`,
      'INVITATION_EMAIL_FAILED', { invitation_url: input.url, delivery: 'failed' });
  }
}

export async function cleanupRejectedInvitationAccount(db: SupabaseClient, createdId: string, definitelyRejected: boolean) {
  // A lost RPC response may follow a successful commit. Deleting that account
  // would destroy an accepted login, so ambiguous outcomes must retain it.
  if (!definitelyRejected) return;
  try {
    const { data: linked, error } = await db.from('employees').select('id').eq('auth_user_id', createdId).limit(1);
    if (error || linked?.length) return;
    const removed = await db.auth.admin.deleteUser(createdId);
    if (removed.error) console.warn('[employee-invitation] rejected-account cleanup deferred');
  } catch {
    console.warn('[employee-invitation] rejected-account cleanup deferred');
  }
}
