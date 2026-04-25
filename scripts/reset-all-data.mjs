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

let errors = 0;

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
  // Use created_at filter — all rows have this column; matches every real row
  const { error } = await supabase
    .from(table)
    .delete()
    .gte('created_at', '1970-01-01');

  if (error && error.code === 'PGRST205') {
    console.log(`  SKIP ${table}: table does not exist`);
  } else if (error) {
    console.error(`  ERROR ${table}: ${error.message} (code: ${error.code})`);
    errors++;
  } else {
    console.log(`  DELETED ${table}`);
  }
}

console.log("\n=== Step 2: Delete all auth users ===");
let totalDeleted = 0;
const MAX_ATTEMPTS = 200;
let attempts = 0;
const failedUserIds = new Set();

// Always fetch page 1 after each deletion to avoid pagination-skip bug
while (attempts < MAX_ATTEMPTS) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (error) {
    console.error("  Error listing users:", error.message);
    errors++;
    break;
  }
  if (!data.users || data.users.length === 0) break;

  // Filter out users that have already failed to prevent infinite loop
  const candidates = data.users.filter(u => !failedUserIds.has(u.id));
  if (candidates.length === 0) {
    console.error(`  Stopping: ${failedUserIds.size} user(s) could not be deleted.`);
    errors += failedUserIds.size;
    break;
  }

  for (const user of candidates) {
    attempts++;
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error(`  ERROR deleting ${user.email}: ${delErr.message}`);
      failedUserIds.add(user.id);
    } else {
      console.log(`  Deleted user: ${user.email}`);
      totalDeleted++;
    }
  }
}

if (attempts >= MAX_ATTEMPTS) {
  console.error(`  Stopped after ${MAX_ATTEMPTS} attempts to prevent infinite loop.`);
  errors++;
}

console.log("\n=== Step 3: Verification ===");
let verifyErrors = 0;
for (const table of tables) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error && (error.code === 'PGRST205' || error.code === 'PGRST116')) {
    console.log(`  ${table}: table does not exist (skipped)`);
  } else if (error) {
    console.error(`  ${table}: verification error — ${error.message}`);
    verifyErrors++;
  } else if (count === null || count === 0) {
    console.log(`  ${table}: 0 rows OK`);
  } else {
    console.error(`  ${table}: FAIL — ${count} rows remaining`);
    verifyErrors++;
  }
}

const { data: usersCheck, error: usersCheckErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
const remainingUsers = usersCheck?.users?.length ?? -1;
if (usersCheckErr) {
  console.error(`  auth.users: verification error — ${usersCheckErr.message}`);
  verifyErrors++;
} else if (remainingUsers !== 0) {
  console.error(`  auth.users: FAIL — ${remainingUsers} users remaining`);
  verifyErrors++;
} else {
  console.log(`  auth.users: 0 users OK`);
}

console.log(`\nAuth users deleted: ${totalDeleted}`);
if (errors > 0 || verifyErrors > 0) {
  console.error(`\nReset INCOMPLETE — ${errors} deletion error(s), ${verifyErrors} verification failure(s).`);
  process.exit(1);
} else {
  console.log("\nReset complete. All data and users removed successfully.");
}
