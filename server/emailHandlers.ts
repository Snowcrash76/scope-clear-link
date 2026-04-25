import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || 'https://aswmcyldowvpugmfmykf.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  return createClient(url, key);
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

export async function handleChangeNotification(body: {
  projectId: string;
  changeRequestId: string;
  notificationType: 'created' | 'approved' | 'declined';
  recipientType: 'trade' | 'client';
  changeTitle: string;
  changeDescription: string;
  costImpact?: number;
  timeImpact?: string;
  updateStatus?: 'approved' | 'declined';
  resolutionComment?: string;
}) {
  const supabase = getSupabase();
  const {
    projectId, changeRequestId, notificationType, recipientType,
    changeTitle, changeDescription, costImpact, timeImpact,
    updateStatus, resolutionComment,
  } = body;

  if (updateStatus) {
    const { error } = await supabase.from('change_requests').update({
      status: updateStatus,
      resolved_at: new Date().toISOString(),
      resolution_comment: resolutionComment || null,
    }).eq('id', changeRequestId);
    if (error) throw new Error(`Failed to update change request: ${error.message}`);
  }

  const { data: project, error: projectError } = await supabase
    .from('projects').select('*').eq('id', projectId).single();
  if (projectError || !project) throw new Error('Project not found');

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

  let commentHtml = '';
  if (resolutionComment && notificationType !== 'created') {
    commentHtml = `
      <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #6b7280">
        <h4 style="margin:0 0 8px 0;color:#374151">Comment</h4>
        <p style="margin:0;color:#6b7280">${resolutionComment}</p>
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
    ${impactHtml}${commentHtml}
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

export async function handleQuoteNotification(body: {
  quoteToken: string;
  notificationType: 'approved' | 'declined';
}) {
  const supabase = getSupabase();
  const { quoteToken, notificationType } = body;

  if (!quoteToken) throw new Error('quoteToken is required');
  if (notificationType !== 'approved' && notificationType !== 'declined') {
    throw new Error("notificationType must be 'approved' or 'declined'");
  }

  const { data: quote, error: quoteError } = await supabase
    .from('quotes').select('*').eq('quote_token', quoteToken).single();
  if (quoteError || !quote) throw new Error('Quote not found');

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
