import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { IncomingMessage, ServerResponse } from "http";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://aswmcyldowvpugmfmykf.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzd21jeWxkb3d2cHVnbWZteWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzM1ODQsImV4cCI6MjA5MjUwOTU4NH0.4Fu1v4gPBEQPneT4bRWvdG8n4gWu9_GxQRj82OYsvyY";
const SUPABASE_PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID ?? "aswmcyldowvpugmfmykf";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "email-api",
      configureServer(server) {
        server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
          }

          if (req.url === "/api/send-change-notification" && req.method === "POST") {
            try {
              const { validateSupabaseJwt, handleChangeNotification } = await import("./server/emailHandlers");
              const userId = await validateSupabaseJwt(req.headers["authorization"] as string | undefined);
              const raw = await readBody(req);
              const body = JSON.parse(raw);
              const result = await handleChangeNotification(body, userId);
              sendJson(res, 200, { success: true, result });
            } catch (err: any) {
              const status = err.message === "Unauthorized" ? 401 : 500;
              console.error("[email-api] send-change-notification:", err.message);
              sendJson(res, status, { error: err.message });
            }
            return;
          }

          if (req.url === "/api/send-quote-notification" && req.method === "POST") {
            try {
              const { handleQuoteNotification } = await import("./server/emailHandlers");
              const raw = await readBody(req);
              const body = JSON.parse(raw);
              const result = await handleQuoteNotification(body);
              sendJson(res, 200, { success: true, result });
            } catch (err: any) {
              console.error("[email-api] send-quote-notification:", err.message);
              sendJson(res, 500, { error: err.message });
            }
            return;
          }

          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_KEY),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(SUPABASE_PROJECT_ID),
  },
}));
