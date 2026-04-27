import express from 'express';
import path from 'path';
import { handleChangeNotification, handleQuoteNotification, handleSendQuoteToClient, validateSupabaseJwt } from './emailHandlers';

const app = express();
app.use(express.json());

app.post('/api/send-change-notification', async (req, res) => {
  try {
    const userId = await validateSupabaseJwt(req.headers['authorization']);
    const result = await handleChangeNotification(req.body, userId);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === 'Unauthorized' ? 401 : 500;
    console.error('[email] send-change-notification:', message);
    res.status(status).json({ error: message });
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
    const status = message === 'Unauthorized' ? 401 : 500;
    console.error('[email] send-quote-to-client:', message);
    res.status(status).json({ error: message });
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
