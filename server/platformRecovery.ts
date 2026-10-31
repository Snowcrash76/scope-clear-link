import type { SupabaseClient } from '@supabase/supabase-js';
import { PlatformError } from './platformAccess';

export class RecoveryDeliveryError extends PlatformError {
  constructor(public outcome: 'failed' | 'unconfirmed', message: string) { super(502, message); }
}
export async function deliverPlatformRecovery(
  db: SupabaseClient, email: string, redirectTo: string, eventId: string,
  options: { apiKey?: string; from?: string; send?: typeof fetch } = {},
) {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
  const from = options.from ?? process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new RecoveryDeliveryError('failed', 'Password recovery email delivery is not configured.');
  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
  if (error || !data?.properties?.action_link) throw new RecoveryDeliveryError('failed', 'The secure password recovery link could not be generated.');
  const link = new URL(data.properties.action_link);
  if (link.protocol !== 'https:') throw new RecoveryDeliveryError('failed', 'A secure password recovery link is required.');
  // The recovery token is held only in this request; never log or audit the URL.
  const escaped = link.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  try {
    const response = await (options.send ?? fetch)('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `platform-recovery-${eventId}` },
      body: JSON.stringify({ from, to: [email], subject: 'Reset your ScopeStream password',
        html: `<p>Your system administrator requested a password reset for your ScopeStream account.</p><p><a href="${escaped}">Choose a new password</a></p><p>If you did not expect this, contact your administrator. Your password has not been changed by this request.</p>`,
        text: `Your ScopeStream administrator requested a password reset.\nChoose a new password: ${link.href}\nYour password has not been changed by this request.`,
      }),
    });
    if (!response.ok) throw new RecoveryDeliveryError(response.status < 500 ? 'failed' : 'unconfirmed', 'The password recovery email was rejected or its delivery could not be confirmed. Check the sender settings and retry later.');
  } catch (error) {
    if (error instanceof RecoveryDeliveryError) throw error;
    throw new RecoveryDeliveryError('unconfirmed', 'Password recovery email delivery could not be confirmed. Check the audit log before retrying.');
  }
}
