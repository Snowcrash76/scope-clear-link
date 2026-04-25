import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bazzdojysnmxfccmnqfj.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tables = [
  "appointments",
  "change_requests",
  "project_documents",
  "invoice_line_items",
  "quote_line_items",
  "invoices",
  "quotes",
  "project_stages",
  "projects",
  "profiles"
];

console.log("=== Deleting all table data ===");
for (const table of tables) {
  const { error, count } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.error(`ERROR deleting ${table}:`, error.message);
  } else {
    console.log(`DELETED ${table}`);
  }
}

console.log("\n=== Deleting all auth users ===");
let page = 0;
let totalDeleted = 0;
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 50 });
  if (error) {
    console.error("Error listing users:", error.message);
    break;
  }
  if (!data.users || data.users.length === 0) break;

  for (const user of data.users) {
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error(`ERROR deleting user ${user.email}:`, delErr.message);
    } else {
      console.log(`Deleted user: ${user.email}`);
      totalDeleted++;
    }
  }

  if (data.users.length < 50) break;
  page++;
}

console.log(`\nDone. Deleted ${totalDeleted} auth user(s).`);
