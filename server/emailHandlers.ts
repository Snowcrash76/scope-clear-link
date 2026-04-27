import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://aswmcyldowvpugmfmykf.supabase.co';

function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

function getResendKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return key;
}

function getSiteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return 'http://localhost:5000';
}

async function sendViaResend(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getResendKey()}`,
    },
    body: JSON.stringify({ from: 'ScopeClear <onboarding@resend.dev>', to: [to], subject, html }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(result)}`);
  return result;
}

/**
 * Validate a Supabase JWT. Returns the user ID if valid, throws if not.
 */
export async function validateSupabaseJwt(authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const token = authHeader.slice(7);
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Unauthorized');
  return user.id;
}

export interface ChangeNotificationBody {
  projectId: string;
  changeRequestId: string;
  notificationType: 'created' | 'approved' | 'declined';
  recipientType: 'trade' | 'client';
  changeTitle: string;
  changeDescription: string;
  costImpact?: number;
  timeImpact?: string;
}

/**
 * Send a change request notification email.
 *
 * authenticatedUserId — when provided (trade flow), the user must own the project.
 * When omitted (client-public flow), the request is restricted to 'created'
 * notifications only, and the changeRequest is verified to belong to the project.
 */
export async function handleChangeNotification(
  body: ChangeNotificationBody,
  authenticatedUserId?: string
) {
  const supabase = getSupabaseAdmin();
  const {
    projectId, changeRequestId, notificationType, recipientType,
    changeTitle, changeDescription, costImpact, timeImpact,
  } = body;

  // For unauthenticated (client) calls, restrict to 'created' notifications only.
  // Approval/decline notifications can only be sent by authenticated owners.
  if (!authenticatedUserId && notificationType !== 'created') {
    throw new Error('Unauthorized: only authenticated users can send approval/decline notifications');
  }

  // Fetch project
  const projectQuery = supabase.from('projects').select('*').eq('id', projectId);
  if (authenticatedUserId) {
    // Trade: must own the project
    projectQuery.eq('user_id', authenticatedUserId);
  }
  const { data: project, error: projectError } = await projectQuery.single();
  if (projectError || !project) throw new Error('Project not found or access denied');

  // For unauthenticated calls, verify the change request belongs to this project
  if (!authenticatedUserId) {
    const { data: cr, error: crError } = await supabase
      .from('change_requests').select('id').eq('id', changeRequestId).eq('project_id', projectId).single();
    if (crError || !cr) throw new Error('Change request not found');
  }

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('user_id', project.user_id).single();

  const baseUrl = getSiteUrl();

  let recipientEmail: string;
  let recipientName: string;
  let senderName: string;
  let projectUrl: string;

  if (recipientType === 'client') {
    recipientEmail = project.client_email;
    recipientName = project.client_name;
    senderName = profile?.business_name || 'Your Trade';
    projectUrl = `${baseUrl}/project/${projectId}`;
  } else {
    recipientEmail = profile?.email;
    recipientName = profile?.contact_name || 'Trade';
    senderName = project.client_name;
    projectUrl = `${baseUrl}/manage/${projectId}`;
  }

  if (!recipientEmail) throw new Error('Recipient email not found');

  let subject: string;
  let heading: string;
  let message: string;
  let actionText: string;

  switch (notificationType) {
    case 'created':
      subject = `[${project.name}] New change request requires your attention`;
      heading = 'New Change Request';
      message = recipientType === 'client'
        ? `${senderName} has submitted a change request for your project that requires your review.`
        : `Your client ${senderName} has submitted a change request for the project.`;
      actionText = 'Review Change Request';
      break;
    case 'approved':
      subject = `[${project.name}] Your change request was approved`;
      heading = 'Change Request Approved';
      message = `Great news! ${senderName} has approved your change request.`;
      actionText = 'View Project';
      break;
    case 'declined':
      subject = `[${project.name}] Your change request was declined`;
      heading = 'Change Request Declined';
      message = `${senderName} has declined your change request. Please review the details below.`;
      actionText = 'View Project';
      break;
    default:
      throw new Error('Invalid notification type');
  }

  let impactHtml = '';
  if (costImpact || timeImpact) {
    impactHtml = `
      <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0">
        <h4 style="margin:0 0 8px 0;color:#374151">Impact</h4>
        ${costImpact ? `<p style="margin:4px 0;color:#6b7280">Cost: <strong>$${costImpact.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</strong></p>` : ''}
        ${timeImpact ? `<p style="margin:4px 0;color:#6b7280">Time: <strong>${timeImpact}</strong></p>` : ''}
      </div>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#374151;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);padding:32px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:24px">${heading}</h1>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="color:#6b7280;margin-bottom:24px">Hi ${recipientName},</p>
    <p style="margin-bottom:24px">${message}</p>
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;border-left:4px solid #3b82f6;margin:24px 0">
      <h3 style="margin:0 0 8px 0;color:#1f2937">${changeTitle}</h3>
      <p style="margin:0;color:#6b7280">${changeDescription}</p>
    </div>
    ${impactHtml}
    <div style="text-align:center;margin-top:32px">
      <a href="${projectUrl}" style="display:inline-block;background:#3b82f6;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">${actionText}</a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
      This email was sent regarding project: ${project.name}<br>
      If you have questions, please contact the ${recipientType === 'client' ? 'trade' : 'client'} directly.
    </p>
  </div>
</body></html>`;

  return sendViaResend(recipientEmail, subject, html);
}

export async function handleSendQuoteToClient(
  body: { projectId: string; quoteId: string },
  authenticatedUserId: string
) {
  const supabase = getSupabaseAdmin();
  const { projectId, quoteId } = body;

  if (!projectId || !quoteId) throw new Error('projectId and quoteId are required');

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', authenticatedUserId)
    .single();
  if (projectError || !project) throw new Error('Project not found or access denied');

  if (!project.client_email) throw new Error('Client email not set on project');

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .single();
  if (quoteError || !quote) throw new Error('Quote not found');
  if (!quote.quote_token) throw new Error('Quote has no shareable token');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .single();

  const baseUrl = getSiteUrl();
  const quoteUrl = `${baseUrl}/quote/${quote.quote_token}`;
  const projectUrl = `${baseUrl}/project/${projectId}`;
  const tradeName = profile?.business_name || profile?.contact_name || 'Your trade';
  const clientName = project.client_name || 'there';
  const projectName = project.name;
  const quoteNumber = quote.quote_number;

  const subject = `[${projectName}] Your quote is ready to review`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#374151;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);padding:32px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:24px">Your Quote is Ready</h1>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="color:#6b7280;margin-bottom:24px">Hi ${clientName},</p>
    <p style="margin-bottom:24px"><strong>${tradeName}</strong> has prepared a quote for your project <strong>${projectName}</strong>. You can review the full scope of work, accept or decline, and leave a comment.</p>
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;border-left:4px solid #3b82f6;margin:24px 0">
      <p style="margin:0 0 4px 0;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">Quote reference</p>
      <h3 style="margin:0;color:#1f2937">${quoteNumber}</h3>
    </div>
    <div style="text-align:center;margin-top:32px">
      <a href="${quoteUrl}" style="display:inline-block;background:#3b82f6;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">Review &amp; Accept Quote</a>
    </div>
    <p style="text-align:center;margin-top:20px;color:#6b7280;font-size:14px">
      You can also <a href="${projectUrl}" style="color:#3b82f6;text-decoration:none">view your project page</a> at any time to track progress, review the scope of work and see any change requests.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
      This email was sent on behalf of ${tradeName} regarding project: ${projectName}
    </p>
  </div>
</body></html>`;

  await sendViaResend(project.client_email, subject, html);
  return { clientName: project.client_name };
}

export async function handleQuoteNotification(body: {
  quoteToken: string;
  notificationType: 'approved' | 'declined';
}) {
  const supabase = getSupabaseAdmin();
  const { quoteToken, notificationType } = body;

  if (!quoteToken || typeof quoteToken !== 'string') throw new Error('quoteToken is required');
  if (notificationType !== 'approved' && notificationType !== 'declined') {
    throw new Error("notificationType must be 'approved' or 'declined'");
  }

  const { data: quote, error: quoteError } = await supabase
    .from('quotes').select('*').eq('quote_token', quoteToken).single();
  if (quoteError || !quote) throw new Error('Quote not found');

  // Security: verify quote status matches — prevents spoofed notifications
  if (quote.status !== notificationType) {
    throw new Error('Quote status does not match notificationType');
  }

  const { data: project, error: projectError } = await supabase
    .from('projects').select('*').eq('id', quote.project_id).single();
  if (projectError || !project) throw new Error('Project not found');

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('*').eq('user_id', project.user_id).single();
  if (profileError || !profile) throw new Error('Trade profile not found');

  const recipientEmail = profile.email;
  if (!recipientEmail) throw new Error('Tradesperson email not found');

  const recipientName = profile.contact_name || profile.business_name || 'there';
  const clientName = project.client_name;
  const projectName = project.name;
  const quoteNumber = quote.quote_number;
  const clientComment = quote.client_comment;

  const baseUrl = getSiteUrl();
  const projectUrl = `${baseUrl}/manage/${project.id}`;

  let subject: string;
  let heading: string;
  let message: string;
  let statusColor: string;
  let statusIcon: string;

  if (notificationType === 'approved') {
    subject = `[${projectName}] ${clientName} has accepted your quote`;
    heading = 'Quote Accepted';
    message = `<strong>${clientName}</strong> has accepted your quote for <strong>${projectName}</strong>. You can now proceed with planning the work.`;
    statusColor = '#16a34a';
    statusIcon = '&#10003;';
  } else {
    subject = `[${projectName}] ${clientName} has declined your quote`;
    heading = 'Quote Declined';
    message = `<strong>${clientName}</strong> has declined your quote for <strong>${projectName}</strong>.`;
    statusColor = '#dc2626';
    statusIcon = '&#10005;';
  }

  const commentHtml = clientComment ? `
    <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #6b7280">
      <h4 style="margin:0 0 8px 0;color:#374151">Client's comment</h4>
      <p style="margin:0;color:#6b7280">${clientComment}</p>
    </div>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#374151;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);padding:32px;border-radius:12px 12px 0 0;text-align:center">
    <div style="display:inline-block;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.2);line-height:48px;font-size:24px;color:white;margin-bottom:12px">${statusIcon}</div>
    <h1 style="color:white;margin:0;font-size:24px">${heading}</h1>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="color:#6b7280;margin-bottom:24px">Hi ${recipientName},</p>
    <p style="margin-bottom:24px">${message}</p>
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;border-left:4px solid ${statusColor};margin:24px 0">
      <p style="margin:0 0 4px 0;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">Quote</p>
      <h3 style="margin:0 0 4px 0;color:#1f2937">${quoteNumber}</h3>
      <p style="margin:0;color:#6b7280">${projectName}</p>
    </div>
    ${commentHtml}
    <div style="text-align:center;margin-top:32px">
      <a href="${projectUrl}" style="display:inline-block;background:#3b82f6;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">View Project</a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
      This email was sent regarding project: ${projectName}<br>
      Client: ${clientName}
    </p>
  </div>
</body></html>`;

  return sendViaResend(recipientEmail, subject, html);
}
