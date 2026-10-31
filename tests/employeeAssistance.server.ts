// Isolated fixture process: actual production handlers, synthetic auth/database
// only. This is never imported by the application or sent to Supabase.
import { mock } from 'bun:test';
import express from 'express';
import { localDate, weekStart } from '../shared/employeePortal';
process.env.SESSION_SECRET = 'isolated-assistance-file-capability-test-only';
const access = await import('../server/jobCostAccess');
export const owner = '10000000-0000-4000-8000-000000000001';
export const member = '60000000-0000-4000-8000-000000000001';
const second = '60000000-0000-4000-8000-000000000002';
const job = '20000000-0000-4000-8000-000000000001';
const secondJob = '20000000-0000-4000-8000-000000000002';
const doc = '70000000-0000-4000-8000-000000000001';
const today = localDate();
const employees = [
  { id: member, owner_id: owner, name: 'Mae Installer', email: 'mae@example.invalid', active: true, role: 'labourer', auth_user_id: 'fixture-employee', archived_at: null },
  { id: second, owner_id: owner, name: 'Liam Field', email: 'liam@example.invalid', active: true, role: 'admin', auth_user_id: 'fixture-employee-admin', archived_at: null },
  { id: '60000000-0000-4000-8000-000000000003', owner_id: owner, name: 'Inactive member', active: false, role: 'labourer', auth_user_id: 'inactive', email: 'inactive@example.invalid' },
  { id: '60000000-0000-4000-8000-000000000004', owner_id: owner, name: 'Pending member', active: true, role: 'labourer', auth_user_id: null, email: 'pending@example.invalid' },
  { id: '60000000-0000-4000-8000-000000000005', owner_id: owner, name: 'Removed member', active: false, role: 'labourer', auth_user_id: null, archived_at: today },
];
const tables: Record<string, any[]> = {
  employees,
  projects: [
    { id: job, user_id: owner, name: 'Assigned Northbridge job', client_name: 'Cedar Projects', client_address: 'Test address', employee_notes: 'Meet at loading bay.', total_value: 999999 },
    { id: secondJob, user_id: owner, name: 'Liam private assignment', client_name: 'Other client', total_value: 777777 },
  ],
  employee_assignments: [
    { id: 'assignment-one', owner_id: owner, employee_id: member, project_id: job, appointment_id: 'appointment-one' },
    { id: 'assignment-two', owner_id: owner, employee_id: second, project_id: secondJob, appointment_id: 'appointment-two' },
  ],
  appointments: [
    { id: 'appointment-one', user_id: owner, project_id: job, title: 'Install trim', date: today, start_time: '08:00', end_time: '16:00', notes: 'Staff notes' },
    { id: 'appointment-two', user_id: owner, project_id: secondJob, title: 'Other work', date: today, start_time: '08:00', end_time: '16:00' },
  ],
  employee_cost_rates: [{ employee_id: member, owner_id: owner, hourly_rate: 40 }, { employee_id: second, owner_id: owner, hourly_rate: 80 }],
  employee_time_entries: [{ id: '80000000-0000-4000-8000-000000000001', employee_id: member, owner_id: owner, project_id: job, work_date: today,
    started_at: `${today}T00:00:00Z`, ended_at: `${today}T04:00:00Z`, break_minutes: 0, notes: 'Installed fixture trim', status: 'draft', paid_minutes: 240, rate_snapshot: 40, created_at: `${today}T04:00:00Z` }],
  employee_notifications: [{ id: '90000000-0000-4000-8000-000000000001', employee_id: member, title: 'Assignment updated', body: 'Read-only notification fixture', read_at: null, project_id: job, created_at: `${today}T00:00:00Z` }],
  project_documents: [{ id: doc, project_id: job, file_name: 'crew-guide.pdf', display_name: 'Crew guide', employee_visible: true, file_type: 'application/pdf', purpose: 'document', file_url: `${owner}/${job}/crew-guide.pdf`, storage_bucket: 'project-documents', created_at: `${today}T00:00:00Z` }],
  scope_items: [{ id: 'scope-one', project_id: job, title: 'Install trim', description: 'Employee-safe scope', category: 'included', cost: 999999 }],
  employee_week_submissions: [], employee_audit_events: [], employee_job_notes: [], change_requests: [],
  employee_settings: [{ owner_id: owner, timezone: 'Australia/Sydney', gps_clock_in: false }],
};
const writes: any[] = [];
function query(table: string) {
  let rows = [...(tables[table] ?? [])], columns = '*';
  const result = () => rows.map(row => columns === '*' ? { ...row } : Object.fromEntries(columns.split(',').map(k => [k, row[k]])));
  const chain: any = {
    select: (value = '*') => { columns = value; return chain; },
    eq: (key: string, value: any) => { rows = rows.filter(r => r[key] === value); return chain; },
    neq: (key: string, value: any) => { rows = rows.filter(r => r[key] !== value); return chain; },
    in: (key: string, value: any[]) => { rows = rows.filter(r => value.includes(r[key])); return chain; },
    contains: (key: string, value: any[]) => { rows = rows.filter(r => value.every(v => r[key]?.includes(v))); return chain; },
    gte: (key: string, value: any) => { rows = rows.filter(r => r[key] >= value); return chain; },
    lte: (key: string, value: any) => { rows = rows.filter(r => r[key] <= value); return chain; },
    order: () => chain, is: (key: string, value: any) => { rows = rows.filter(r => (r[key] ?? null) === value); return chain; },
    limit: (n: number) => { rows = rows.slice(0, n); return chain; },
    range: (start: number, end: number) => { rows = rows.slice(start, end + 1); return chain; },
    single: async () => ({ data: result()[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
    then: (resolve: any, reject: any) => Promise.resolve({ data: result(), error: null }).then(resolve, reject),
  };
  return chain;
}
const db = {
  from: query,
  auth: { getUser: async (token: string) => ({ data: { user: token === 'expired' ? null : { id:
    token === 'synthetic-fixture-only' || token === 'fixture-owner' ? owner : token } }, error: null }) },
  rpc: async (name: string, p: any) => {
    if (name === 'portal_assigned') return { data: tables.employee_assignments.some(a => a.employee_id === p.p_employee && a.project_id === p.p_job), error: null };
    if (name === 'portal_file_allowed') return { data: true, error: null };
    if (name === 'portal_manage_employee' && p.p_action === 'update') {
      const employee = employees.find(e => e.id === p.p_employee && e.owner_id === p.p_actor);
      if (!employee) return { data: null, error: { code: '42501', message: 'Employee access denied.' } };
      writes.push({ name, ...p }); Object.assign(employee, p.p_payload);
      tables.employee_audit_events.push({ id: 'audit-one', owner_id: owner, actor_id: p.p_actor, employee_id: employee.id, action: 'employee_updated', detail: {}, created_at: new Date().toISOString() });
      return { data: employee, error: null };
    }
    throw new Error(`Unexpected fixture mutation ${name}`);
  },
  storage: { from: () => ({ download: async () => ({ data: new Blob(['%PDF-1.4 fixture-only']), error: null }) }) },
};
mock.module('../server/jobCostAccess', () => ({ ...access, jobCostClient: () => db }));
const { createEmployeeRouter } = await import('../server/employeeRoutes');
const app = express(); app.use(express.json());
app.use('/api', createEmployeeRouter());
app.get('/__fixture/state', (_req, res) => res.json({ tables, writes, today, week: weekStart(today) }));
app.post('/__fixture/control', (req, res) => {
  if (req.body.member) Object.assign(employees.find(e => e.id === req.body.member), req.body.patch);
  if (req.body.clearAssignments) tables.employee_assignments = tables.employee_assignments.filter(a => a.employee_id !== member);
  res.json({ ok: true });
});
const server = app.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ port: (server.address() as any).port })));
