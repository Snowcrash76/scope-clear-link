import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { publicWebOrigin } from '../shared/publicUrls';

const requestSchema = z.object({
  projectId: z.string().uuid(),
  to: z.string().trim().email().max(254).refine(value => !/[\r\n]/.test(value)),
  subject: z.string().trim().min(1).max(200).refine(value => !/[\r\n]/.test(value)),
  message: z.string().trim().min(1).max(10000),
  sendCopy: z.boolean().default(false),
  confirmDifferentRecipient: z.boolean().default(false),
}).strict();

export class ClientPageEmailError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Dependencies = {
  db: SupabaseClient;
  baseUrl: string;
  makeLink: (projectId: string, baseUrl: string) => Promise<string>;
  send: (to: string, subject: string, html: string, bcc?: string[]) => Promise<{ id?: string }>;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

/** Owner-only delivery. Never accepts an access token or a client URL from the browser. */
export async function sendClientPageLink(input: unknown, userId: string, dependencies: Dependencies) {
  if (!userId) throw new ClientPageEmailError(401, 'Please sign in.');
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) throw new ClientPageEmailError(400, 'Enter a valid recipient, subject and message.');
  const body = parsed.data;
  const { db } = dependencies;
  const { data: project, error } = await db.from('projects')
    .select('id,user_id,name,client_email,status').eq('id', body.projectId).eq('user_id', userId).maybeSingle();
  if (error || !project) throw new ClientPageEmailError(404, 'Job not found or access denied.');
  if (body.to.toLowerCase() !== String(project.client_email ?? '').trim().toLowerCase() && !body.confirmDifferentRecipient)
    throw new ClientPageEmailError(400, 'Confirm sending to an address different from the saved client email.');

  let copyEmail: string | undefined;
  if (body.sendCopy) {
    const profile = await db.from('profiles').select('email').eq('user_id', userId).maybeSingle();
    const email = z.string().email().safeParse(profile.data?.email?.trim());
    if (profile.error || !email.success)
      throw new ClientPageEmailError(400, 'Your business email is unavailable. Update it or turn off Send me a copy.');
    copyEmail = email.data;
  }
  const link = await dependencies.makeLink(project.id, dependencies.baseUrl);
  const url = new URL(link);
  // Defence in depth: allow only the configured origin and a separate capability.
  if (url.origin !== publicWebOrigin(dependencies.baseUrl) ||
      url.pathname !== `/project/${project.id}` || !z.string().uuid().safeParse(url.searchParams.get('access')).success)
    throw new ClientPageEmailError(500, 'Could not generate a secure client link.');

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#202520;line-height:1.6">
    <h1>${escapeHtml(project.name)}</h1>
    <p style="white-space:pre-wrap">${escapeHtml(body.message)}</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#f0ad00;color:#202520;text-decoration:none;border-radius:8px">View your client page</a></p>
    <p>This private link lets you view the client sections available for this job. Only share it with people you trust.</p>
    <p style="font-size:12px">Sent using ScopeClear.</p></body></html>`;
  let delivery: { id?: string };
  try {
    delivery = await dependencies.send(body.to, body.subject, html,
      copyEmail && copyEmail.toLowerCase() !== body.to.toLowerCase() ? [copyEmail] : undefined);
  } catch {
    throw new ClientPageEmailError(502, 'The email provider could not send this message. Please retry.');
  }
  // A compare-and-set avoids overwriting a concurrent in-progress/completed status.
  // Email failure never changes job status; failure after sending must not invite duplicate delivery.
  let markedSent = false;
  let warning: string | undefined;
  if (project.status === 'draft') {
    const update = await db.from('projects').update({ status: 'sent' })
      .eq('id', project.id).eq('user_id', userId).eq('status', 'draft').select('id');
    if (update.error) warning = 'The email was sent, but the job status could not be updated. Refresh the job before retrying anything.';
    else markedSent = Boolean(update.data?.length);
  }
  return {
    success: true as const, messageId: delivery.id ?? null,
    markedSent, copySent: Boolean(copyEmail), activityRecorded: false as const,
    ...(warning ? { warning } : {}),
  };
}
