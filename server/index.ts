import express from 'express';
import path from 'path';
import { inviteErrorMessage } from '../shared/adminInvites';
import { createJobCostRouter } from './jobCostRoutes';
import { createEmployeeRouter } from './employeeRoutes';
import { createClientAccessRouter, requireOwnerOrClient } from './clientAccess';
import { handleChangeNotification, handleQuoteNotification, handleSendQuoteToClient, handleSendInvoiceToClient, handleGetSignedUploadUrl, handleRecordClientDocument, handleSendScopeChangeNotification, handleDocumentUploadNotification, handleClientDocumentUploadNotification, validateSupabaseJwt, handleSendClientPageLink } from './emailHandlers';
import { ClientPageEmailError } from './clientPageEmail';

export const app = express();
// Compressed scan images can exceed the default 100 KB JSON limit.
app.use('/api/receipts', express.json({ limit: '8mb' }));
app.use('/api/job-costs', express.json({ limit: '1mb' }));
app.use(express.json());
app.use('/api', createJobCostRouter());
app.use('/api', createEmployeeRouter());
app.use('/api', createClientAccessRouter());
app.use(['/api/get-signed-upload-url','/api/record-client-document',
  '/api/send-change-notification','/api/send-quote-notification',
  '/api/send-client-document-notification','/api/send-document-notification'], requireOwnerOrClient);

app.post('/api/send-change-notification', async (req, res) => {
  try {
    // Auth is optional: authenticated = trade-originated, unauthenticated = client-originated
    let userId: string | undefined;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try { userId = await validateSupabaseJwt(authHeader); } catch { /* unauthenticated */ }
    }
    const result = await handleChangeNotification(req.body, userId);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] send-change-notification:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/api/send-quote-notification', async (req, res) => {
  try {
    const result = await handleQuoteNotification(req.body);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] send-quote-notification:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/api/send-quote-to-client', async (req, res) => {
  try {
    const userId = await validateSupabaseJwt(req.headers['authorization']);
    const result = await handleSendQuoteToClient(req.body, userId);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === 'Unauthorized' ? 401
      : message === 'Client email not set on project' ? 400
      : 500;
    console.error('[email] send-quote-to-client:', message);
    res.status(status).json({ error: message });
  }
});

app.post('/api/send-client-page-link', async (req, res) => {
  try {
    const userId = await validateSupabaseJwt(req.headers.authorization);
    res.json(await handleSendClientPageLink(req.body, userId));
  } catch (error) {
    const status = error instanceof ClientPageEmailError ? error.status
      : error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    res.status(status).json({
      error: error instanceof ClientPageEmailError ? error.message
        : status === 401 ? 'Please sign in.' : 'Could not send the client page. Please retry.',
    });
  }
});

app.post('/api/send-invoice-to-client', async (req, res) => {
  try {
    const userId = await validateSupabaseJwt(req.headers['authorization']);
    const result = await handleSendInvoiceToClient(req.body, userId);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === 'Unauthorized' ? 401
      : message === 'Client email not set on project' ? 400
      : 500;
    console.error('[email] send-invoice-to-client:', message);
    res.status(status).json({ error: message });
  }
});

app.post('/api/send-scope-change-notification', async (req, res) => {
  try {
    const userId = await validateSupabaseJwt(req.headers['authorization']);
    const result = await handleSendScopeChangeNotification(req.body, userId);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === 'Unauthorized' ? 401 : message === 'No client email on project' ? 400 : 500;
    console.error('[email] send-scope-change-notification:', message);
    res.status(status).json({ error: message });
  }
});

app.post('/api/get-signed-upload-url', async (req, res) => {
  try {
    const result = await handleGetSignedUploadUrl(req.body);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] get-signed-upload-url:', message);
    res.status(message === 'Project not found' ? 404 : 500).json({ error: message });
  }
});

app.post('/api/send-document-notification', async (req, res) => {
  try {
    const userId = await validateSupabaseJwt(req.headers['authorization']);
    const result = await handleDocumentUploadNotification(req.body, userId);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === 'Unauthorized' ? 401
      : message === 'No client email on project' ? 400
      : 500;
    console.error('[email] send-document-notification:', message);
    res.status(status).json({ error: message });
  }
});

app.post('/api/send-client-document-notification', async (req, res) => {
  try {
    const result = await handleClientDocumentUploadNotification(req.body);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] send-client-document-notification:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/api/record-client-document', async (req, res) => {
  try {
    const result = await handleRecordClientDocument(req.body);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] record-client-document:', message);
    res.status(500).json({ error: message });
  }
});

// Invite code validation — called before signup to check the code is valid and unused
app.post('/api/validate-invite-code', async (req, res) => {
  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ valid: false, error: 'No code provided' });

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || 'https://aswmcyldowvpugmfmykf.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .select('id, used_at')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();

  if (error || !data) return res.json({ valid: false, error: 'Invalid invite code' });
  if (data.used_at) return res.json({ valid: false, error: 'This invite code has already been used' });

  return res.json({ valid: true, codeId: data.id });
});

// Mark invite code as used after successful signup
app.post('/api/consume-invite-code', async (req, res) => {
  const { codeId, email } = req.body as { codeId?: string; email?: string };
  if (!codeId) return res.status(400).json({ success: false });

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || 'https://aswmcyldowvpugmfmykf.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  await supabaseAdmin
    .from('invite_codes')
    .update({ used_by_email: email || null, used_at: new Date().toISOString() })
    .eq('id', codeId);

  return res.json({ success: true });
});

// ─── Admin helpers ────────────────────────────────────────────────────────────

async function getAdminSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    process.env.VITE_SUPABASE_URL || 'https://aswmcyldowvpugmfmykf.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function requireAdmin(authHeader: string | undefined): Promise<void> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const token = authHeader.slice(7);
  const sb = await getAdminSupabase();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user?.email) throw new Error('Unauthorized');
  // Accept ADMIN_EMAIL (server-only) with fallback to VITE_ADMIN_EMAIL (shared)
  const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) throw new Error('Forbidden');
}

// GET /api/admin/stats — platform-wide aggregate counts
app.get('/api/admin/stats', async (req, res) => {
  try {
    await requireAdmin(req.headers['authorization']);
    const sb = await getAdminSupabase();

    const [
      { count: totalUsers },
      { data: projectRows },
      { data: quoteRows },
      { data: invoiceRows },
      { count: unusedCodes },
    ] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('projects').select('status'),
      sb.from('quotes').select('status'),
      sb.from('invoices').select('status, total'),
      sb.from('invite_codes').select('*', { count: 'exact', head: true }).is('used_at', null),
    ]);

    const projectsByStatus = (projectRows || []).reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    const quotesApproved = (quoteRows || []).filter(q => q.status === 'approved').length;
    const quotesSent = (quoteRows || []).filter(q => ['sent','approved','declined'].includes(q.status)).length;
    const invoicesPaid = (invoiceRows || []).filter(i => i.status === 'paid').length;
    const totalRevenue = (invoiceRows || [])
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);

    res.json({
      totalUsers: totalUsers ?? 0,
      projectsByStatus,
      quotesSent,
      quotesApproved,
      invoicesPaid,
      totalRevenue,
      unusedInviteCodes: unusedCodes ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(message === 'Forbidden' ? 403 : message === 'Unauthorized' ? 401 : 500).json({ error: message });
  }
});

// GET /api/admin/users — all trade accounts with project counts
app.get('/api/admin/users', async (req, res) => {
  try {
    await requireAdmin(req.headers['authorization']);
    const sb = await getAdminSupabase();

    const { data: profiles, error } = await sb
      .from('profiles')
      .select('id, user_id, email, business_name, contact_name, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get project counts per user
    const { data: projectCounts } = await sb
      .from('projects')
      .select('user_id');

    const countMap = (projectCounts || []).reduce<Record<string, number>>((acc, p) => {
      acc[p.user_id] = (acc[p.user_id] || 0) + 1;
      return acc;
    }, {});

    const users = (profiles || []).map(p => ({
      ...p,
      projectCount: countMap[p.user_id] || 0,
    }));

    res.json(users);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(message === 'Forbidden' ? 403 : message === 'Unauthorized' ? 401 : 500).json({ error: message });
  }
});

// GET /api/admin/activity — 50 most recent platform events
app.get('/api/admin/activity', async (req, res) => {
  try {
    await requireAdmin(req.headers['authorization']);
    const sb = await getAdminSupabase();

    const [{ data: signups }, { data: projects }] = await Promise.all([
      sb.from('profiles')
        .select('id, email, business_name, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      sb.from('projects')
        .select('id, name, client_name, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const events = [
      ...(signups || []).map(s => ({
        type: 'signup' as const,
        id: `signup-${s.id}`,
        title: s.business_name || s.email,
        subtitle: s.email,
        createdAt: s.created_at,
      })),
      ...(projects || []).map(p => ({
        type: 'project' as const,
        id: `project-${p.id}`,
        title: p.name,
        subtitle: `Client: ${p.client_name || 'No client'}`,
        createdAt: p.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    res.json(events);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(message === 'Forbidden' ? 403 : message === 'Unauthorized' ? 401 : 500).json({ error: message });
  }
});

// GET /api/admin/invites — list all invite codes
app.get('/api/admin/invites', async (req, res) => {
  try {
    await requireAdmin(req.headers['authorization']);
    const sb = await getAdminSupabase();
    const { data, error } = await sb
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(503).json({ error: inviteErrorMessage(error) });
    res.json(data || []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(message === 'Forbidden' ? 403 : message === 'Unauthorized' ? 401 : 500).json({ error: message });
  }
});

// POST /api/admin/invites — create one or many invite codes
app.post('/api/admin/invites', async (req, res) => {
  try {
    await requireAdmin(req.headers['authorization']);
    const { codes } = req.body as { codes: Array<{ code: string; label: string | null }> };
    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: 'codes array is required' });
    }
    const sb = await getAdminSupabase();
    const { data, error } = await sb.from('invite_codes').insert(codes).select();
    if (error) return res.status(503).json({ error: inviteErrorMessage(error) });
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(message === 'Forbidden' ? 403 : message === 'Unauthorized' ? 401 : 500).json({ error: message });
  }
});

// DELETE /api/admin/invites/:id — delete an unused invite code
app.delete('/api/admin/invites/:id', async (req, res) => {
  try {
    await requireAdmin(req.headers['authorization']);
    const { id } = req.params;
    const sb = await getAdminSupabase();
    const { error } = await sb.from('invite_codes').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(message === 'Forbidden' ? 403 : message === 'Unauthorized' ? 401 : 500).json({ error: message });
  }
});

// GET /api/quotes/:quoteId/line-item-history
// Accepts Bearer JWT (trade owner) or ?token= (client share token).
// Returns a unified activity payload:
//   { history: LineItemHistoryRow[], changeRequests: ChangeRequestRow[], quote: QuoteSummary }
// The unified feed is assembled client-side by merging all three collections,
// which keeps the endpoint simple and lets each consumer decide what to display.
app.get('/api/quotes/:quoteId/line-item-history', async (req, res) => {
  try {
    const { quoteId } = req.params;
    const quoteToken = req.query.token as string | undefined;
    const sb = await getAdminSupabase();

    // ── Auth ──────────────────────────────────────────────────────────────────
    let authorized = false;
    let projectId: string | undefined;

    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const userId = await validateSupabaseJwt(authHeader);
        if (userId) {
          const { data: q } = await sb
            .from('quotes')
            .select('project_id')
            .eq('id', quoteId)
            .single();
          if (q) {
            const { data: p } = await sb
              .from('projects')
              .select('user_id')
              .eq('id', q.project_id)
              .single();
            if (p?.user_id === userId) {
              authorized = true;
              projectId = q.project_id;
            }
          }
        }
      } catch { /* not authorized via JWT */ }
    }

    if (!authorized && quoteToken) {
      const { data: q } = await sb
        .from('quotes')
        .select('id, project_id')
        .eq('id', quoteId)
        .eq('quote_token', quoteToken)
        .single();
      if (q) {
        authorized = true;
        projectId = q.project_id;
      }
    }

    if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

    // ── Fetch unified activity data in parallel ───────────────────────────────
    const [quoteRes, histRes, crRes] = await Promise.all([
      sb.from('quotes')
        .select('id, status, created_at, approved_at, declined_at')
        .eq('id', quoteId)
        .single(),
      sb.from('quote_line_item_history')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true }),
      projectId
        ? sb.from('change_requests')
            .select('id, title, status, cost_impact, created_at, resolved_at')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    // History table may not exist yet (pre-migration) — return empty gracefully
    let history: unknown[] = [];
    if (histRes.error) {
      const pgErr = histRes.error as { code?: string; message?: string };
      if (pgErr.code !== '42P01' && !(pgErr.message ?? '').includes('does not exist')) {
        throw histRes.error;
      }
    } else {
      history = histRes.data || [];
    }

    const q = quoteRes.data;
    res.json({
      history,
      changeRequests: crRes.data || [],
      quote: q ? {
        id: q.id,
        status: q.status,
        createdAt: q.created_at,
        approvedAt: q.approved_at ?? null,
        declinedAt: q.declined_at ?? null,
      } : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[history] line-item-history:', message);
    res.status(500).json({ error: message });
  }
});

export function startServer() {
// ─── Static frontend ───────────────────────────────────────────────────────────
// Serve Vite-built frontend (files are in dist/client/ alongside dist/index.cjs)
const clientDir = path.join(__dirname, 'client');
app.use(express.static(clientDir));
// Catch-all: serve index.html for all GET requests (enables client-side routing)
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(clientDir, 'index.html'));
  } else {
    next();
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
}
