import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://aswmcyldowvpugmfmykf.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzd21jeWxkb3d2cHVnbWZteWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzM1ODQsImV4cCI6MjA5MjUwOTU4NH0.4Fu1v4gPBEQPneT4bRWvdG8n4gWu9_GxQRj82OYsvyY";
const SUPABASE_PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID ?? "aswmcyldowvpugmfmykf";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
