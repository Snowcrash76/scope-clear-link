export const employeeRoles = ['labourer', 'supervisor', 'admin'] as const;
export type EmployeeRole = typeof employeeRoles[number];
export const permissionNames = ['view_scope', 'view_variations', 'view_documents', 'add_photos', 'add_notes', 'review_timesheets'] as const;
export type OperationalPermissions = Record<typeof permissionNames[number], boolean>;
export const defaultPermissions: Record<EmployeeRole, OperationalPermissions> = {
  labourer: { view_scope: true, view_variations: true, view_documents: true, add_photos: true, add_notes: true, review_timesheets: false },
  supervisor: { view_scope: true, view_variations: true, view_documents: true, add_photos: true, add_notes: true, review_timesheets: true },
  admin: { view_scope: true, view_variations: true, view_documents: true, add_photos: true, add_notes: true, review_timesheets: true },
};
export interface PortalEmployee {
  id: string; name: string; email: string; role: EmployeeRole; active: boolean; auth_user_id?: string | null; archived_at?: string | null;
}
export interface PortalSession {
  employee: PortalEmployee | null; canManageTeam: boolean; setupRequired?: boolean;
}
export interface PortalJob {
  id: string; name: string; client_name: string; client_address: string | null;
  client_phone: string | null; employee_notes: string | null;
}
export interface PortalAssignment {
  id: string; employee_id: string; project_id: string; appointment_id: string;
  date: string; start_time: string; end_time: string; notes: string | null; employee_name?: string;
}
export interface PortalTimeEntry {
  id: string; employee_id: string; project_id: string; work_date: string;
  started_at: string; ended_at: string | null; break_minutes: number; notes: string;
  status: 'draft' | 'submitted' | 'approved'; paid_minutes: number | null; created_at: string;
}
export interface PortalSubmission {
  id: string; employee_id: string; week_start: string; status: 'submitted' | 'approved' | 'rejected';
  review_comment: string | null; submitted_at: string; employee_name?: string;
}
export interface PortalDocument {
  id: string; project_id: string; file_name: string; display_name: string | null;
  file_type: string | null; purpose: string; caption: string | null; photo_stage: string | null;
  employee_visible: boolean; created_at: string;
}
export interface PortalNote { id: string; project_id: string; employee_id: string; body: string; created_at: string }
export interface PortalNotification {
  id: string; title: string; body: string; project_id: string | null; read_at: string | null; created_at: string;
}
export interface EmployeeBootstrap {
  employee: PortalEmployee; permissions: OperationalPermissions; timezone: string; today: string;
  jobs: PortalJob[]; assignments: PortalAssignment[]; entries: PortalTimeEntry[];
  submissions: PortalSubmission[]; documents: PortalDocument[]; notes: PortalNote[];
  notifications: PortalNotification[];
}
export interface EmployeeJobDetail {
  job: PortalJob; documents: PortalDocument[]; notes: PortalNote[];
  scope: { id: string; title: string; description: string | null; category: string }[];
  variations: { id: string; title: string; description: string | null; status: string }[];
}
export interface TeamBootstrap {
  employees: (PortalEmployee & { hourly_rate: number | null })[];
  jobs: PortalJob[]; appointments: { id: string; project_id: string | null; title: string; date: string; start_time: string; end_time: string }[];
  assignments: PortalAssignment[]; entries: PortalTimeEntry[]; submissions: PortalSubmission[];
  permissions: Record<EmployeeRole, OperationalPermissions>; timezone: string;
  notes: PortalNote[]; documents: PortalDocument[]; audit: { id: string; action: string; created_at: string; actor_id: string; detail: unknown }[];
}
export interface PortalReviews { submissions: PortalSubmission[]; entries: PortalTimeEntry[]; jobs: PortalJob[]; employees: PortalEmployee[] }
export const roleLabels: Record<EmployeeRole, string> = { labourer: 'Labourer', supervisor: 'Leading Hand / Supervisor', admin: 'Admin' };

export function weekStart(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day.valueOf()) || day.toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
export function paidMinutes(start: string, end: string, unpaidBreak: number): number {
  const duration = (Date.parse(end) - Date.parse(start)) / 60000;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1440 || !Number.isInteger(unpaidBreak) || unpaidBreak < 0 || unpaidBreak >= duration) throw new Error('Check start, finish and unpaid break');
  return Math.round(duration - unpaidBreak);
}
export function labourCost(minutes: number, hourlyRate: number): number {
  if (minutes < 0 || !Number.isFinite(minutes) || hourlyRate < 0 || !Number.isFinite(hourlyRate)) throw new Error('Invalid labour calculation');
  return Math.round((minutes * hourlyRate / 60 + Number.EPSILON) * 100) / 100;
}
export function localDate(now = new Date(), timezone = 'Australia/Sydney'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
/** Resolve a business-local datetime without silently accepting a DST gap/ambiguous time. */
export function localDateTimeToUtc(value: string, timezone = 'Australia/Sydney'): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter a date and time');
  const target = Date.parse(`${value}:00Z`);
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const candidates: string[] = [];
  // Includes half-hour zones. Offsets span every current civil timezone.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = new Date(target - offset * 60000);
    if (formatter.format(candidate).replace(' ', 'T') === value) candidates.push(candidate.toISOString());
  }
  if (candidates.length !== 1) throw new Error('This local time is missing or repeats at daylight saving. Choose an unambiguous time.');
  return candidates[0];
}
