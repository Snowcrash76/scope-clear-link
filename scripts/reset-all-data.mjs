/**
 * ScopeClear — Full Data Reset Script
 *
 * Deletes all rows from every public table (in FK-safe dependency order)
 * and all Supabase Auth users.
 *
 * Requires:
 *   SUPABASE_URL       — e.g. https://aswmcyldowvpugmfmykf.supabase.co
 *   SERVICE_ROLE_KEY   — Supabase service_role JWT (bypasses RLS)
 *
 * Usage:
 *   SUPABASE_URL=https://... SERVICE_ROLE_KEY=eyJ... node scripts/reset-all-data.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Deletion order: leaf tables first, then parents (respects FK constraints)
const tables = [
  "appointments",
  "change_requests",
  "project_documents",
  "scope_items",
  "invoice_line_items",
  "quote_line_items",
  "invoices",
  "quotes",
  "project_stages",
  "projects",
  "profiles",
];

console.log("=== Step 1: Delete all table data ===");
for (const table of tables) {
  const { error, count } = await supabase
    .from(table)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id', { count: 'exact', head: true });

  if (error && error.code !== 'PGRST116') {
    console.error(`  ERROR ${table}: ${error.message} (code: ${error.code})`);
  } else {
    console.log(`  DELETED ${table}`);
  }
}

console.log("\n=== Step 2: Delete all auth users ===");
let page = 0;
let totalDeleted = 0;
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 50 });
  if (error) { console.error("  Error listing users:", error.message); break; }
  if (!data.users || data.users.length === 0) break;

  for (const user of data.users) {
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error(`  ERROR deleting ${user.email}: ${delErr.message}`);
    } else {
      console.log(`  Deleted user: ${user.email}`);
      totalDeleted++;
    }
  }
  if (data.users.length < 50) break;
  page++;
}

console.log("\n=== Step 3: Verification ===");
for (const table of tables) {
  const { data, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error && error.code !== 'PGRST116') {
    console.log(`  ${table}: (table not found / ${error.code})`);
  } else {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${count ?? 0} rows remaining`);
  }
}
const { data: usersCheck } = await supabase.auth.admin.listUsers({ page: 0, perPage: 50 });
console.log(`  auth.users: ${usersCheck?.users?.length ?? 0} users remaining`);

console.log(`\nReset complete. Auth users deleted: ${totalDeleted}`);
