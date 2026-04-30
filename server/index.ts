import express from 'express';
import path from 'path';
import { handleChangeNotification, handleQuoteNotification, handleSendQuoteToClient, handleSendInvoiceToClient, handleGetSignedUploadUrl, handleRecordClientDocument, handleSendScopeChangeNotification, validateSupabaseJwt } from './emailHandlers';

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
