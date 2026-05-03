import express from 'express';
import path from 'path';
import { handleChangeNotification, handleQuoteNotification, handleSendQuoteToClient, handleSendInvoiceToClient, handleGetSignedUploadUrl, handleRecordClientDocument, handleSendScopeChangeNotification, handleDocumentUploadNotification, handleClientDocumentUploadNotification, validateSupabaseJwt } from './emailHandlers';

const app = express();
app.use(express.json());

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
