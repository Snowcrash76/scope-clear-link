import { Router } from 'express';
import { z } from 'zod';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CostApiError, jobCostClient } from './jobCostAccess';
import {
  assignedJobs, fileCapability, portalActor, portalDbCheck, portalError, portalHandler, portalMutate,
  portalPermissions, portalRows, requireAssigned, requireEmployee, requireTeam,
  safeDocumentColumns, safeEmployeeColumns, safeEntryColumns, safeJobColumns, verifyFileCapability, type PortalActor,
} from './employeeAccess';
import { defaultPermissions, employeeRoles, localDate, permissionNames, type EmployeeRole } from '../shared/employeePortal';

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
const text = z.string().trim().max(5000);
const gps = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).strict().optional();
const employeeCreate = z.object({
  name: z.string().trim().min(1).max(200), email: z.string().trim().email().transform(s => s.toLowerCase()),
  role: z.enum(employeeRoles), active: z.boolean().default(true), hourly_rate: z.number().min(0).max(100000).nullable().optional(),
}).strict();
const employeeEdit = employeeCreate.omit({ email: true }).partial().strict();
const timeBody = z.object({ project_id: id, started_at: z.string().datetime({ offset: true }), ended_at: z.string().datetime({ offset: true }), break_minutes: z.number().int().min(0).max(1439).default(0), notes: text.default('') }).strict();
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const permissionsSchema = z.object(Object.fromEntries(permissionNames.map(k => [k, z.boolean()])) as Record<typeof permissionNames[number], z.ZodBoolean>).strict();
const publicEmployee = (e: any) => ({ id: e.id, name: e.name, email: e.email, role: e.role, active: e.active, auth_user_id: e.auth_user_id });
const paramsId = (value: unknown) => id.parse(value);

export async function authorisedDocument(db: any, actor: PortalActor, documentId: string) {
  const { data: doc, error } = await db.from('project_documents').select('*').eq('id', documentId).maybeSingle();
  portalDbCheck(error);
  if (!doc) throw new CostApiError(404, 'Document not found.');
  if (actor.canManageTeam) {
    requireTeam(actor);
    const { data: project, error: pe } = await db.from('projects').select('id').eq('id', doc.project_id).eq('user_id', actor.ownerId).maybeSingle();
    portalDbCheck(pe); if (!project) throw new CostApiError(403, 'Document access denied.');
  } else {
    await requireAssigned(db, actor, doc.project_id);
    const permissions = await portalPermissions(db, actor.ownerId, actor.employee.role);
    if (!permissions.view_documents || !doc.employee_visible) throw new CostApiError(403, 'This document is not published for employees.');
  }
  return doc;
}
function objectPath(doc: any, ownerId: string) {
  const bucket = doc.storage_bucket || 'project-documents';
  const path = doc.file_url.includes('/storage/v1/object/')
    ? decodeURIComponent(doc.file_url.split(`/${bucket}/`)[1]?.split('?')[0] || '')
    : doc.file_url;
  if (!path || path.includes('..') || !['project-documents','employee-photos'].includes(bucket)) throw new CostApiError(400, 'Invalid private document.');
  return { bucket, path };
}

export function createEmployeeRouter() {
  const router = Router();
  router.get('/team/setup', portalHandler(async (_req, _db, actor) => {
    if (actor.employee) throw new CostApiError(403, 'Database setup is available to the business owner only.');
    return {
      sql: readFileSync(path.resolve('supabase/migrations/20261029000000_employee_portal.sql'), 'utf8'),
      editor_url: 'https://supabase.com/dashboard/project/aswmcyldowvpugmfmykf/sql/new',
    };
  }));
  router.get('/employee/session', portalHandler(async (_req, _db, actor) => ({
    employee: actor.employee ? publicEmployee(actor.employee) : null,
    canManageTeam: actor.canManageTeam, setupRequired: !!actor.setupRequired,
  })));
  router.get('/employee/bootstrap', portalHandler(async (_req, db, actor) => {
    const employee = requireEmployee(actor);
    const jobs = await assignedJobs(db, actor);
    const permissions = await portalPermissions(db, actor.ownerId, employee.role);
    const assignments = await portalRows(() => db.from('employee_assignments').select('id,employee_id,project_id,appointment_id').eq('employee_id', employee.id).eq('owner_id', actor.ownerId));
    const appointmentIds = assignments.map(a => a.appointment_id);
    const [safeJobs, appointments, entries, submissions, documents, notes, notifications] = await Promise.all([
      jobs.length ? portalRows(() => db.from('projects').select(safeJobColumns).in('id', jobs).eq('user_id', actor.ownerId)) : [],
      appointmentIds.length ? portalRows(() => db.from('appointments').select('id,date,start_time,end_time,notes').in('id', appointmentIds).eq('user_id', actor.ownerId)) : [],
      portalRows(() => db.from('employee_time_entries').select(safeEntryColumns).eq('employee_id', employee.id).order('started_at', { ascending: false })),
      portalRows(() => db.from('employee_week_submissions').select('id,employee_id,week_start,status,review_comment,submitted_at').eq('employee_id', employee.id).order('week_start', { ascending: false })),
      permissions.view_documents && jobs.length ? portalRows(() => db.from('project_documents').select(safeDocumentColumns).in('project_id', jobs).eq('employee_visible', true).order('created_at', { ascending: false })) : [],
      jobs.length ? portalRows(() => db.from('employee_job_notes').select('id,project_id,employee_id,body,created_at').in('project_id', jobs).eq('owner_id', actor.ownerId).order('created_at', { ascending: false })) : [],
      portalRows(() => db.from('employee_notifications').select('id,title,body,project_id,read_at,created_at').eq('employee_id', employee.id).order('created_at', { ascending: false })),
    ]);
    return {
      employee: publicEmployee(employee), permissions, timezone: 'Australia/Sydney', today: localDate(),
      jobs: safeJobs, assignments: assignments.flatMap(a => { const ap = appointments.find(p => p.id === a.appointment_id); return ap ? [{ ...a, date: ap.date, start_time: ap.start_time, end_time: ap.end_time, notes: ap.notes }] : []; }),
      entries, submissions, documents, notes, notifications,
    };
  }));
  router.get('/employee/jobs/:id', portalHandler(async (req, db, actor) => {
    const jobId = paramsId(req.params.id); await requireAssigned(db, actor, jobId);
    const p = await portalPermissions(db, actor.ownerId, actor.employee.role);
    const { data: job, error } = await db.from('projects').select(safeJobColumns).eq('id', jobId).eq('user_id', actor.ownerId).single(); portalDbCheck(error);
    const [scope, variations, documents, notes] = await Promise.all([
      p.view_scope ? portalRows(() => db.from('scope_items').select('id,title,description,category').eq('project_id', jobId)) : [],
      p.view_variations ? portalRows(() => db.from('change_requests').select('id,title,description,status').eq('project_id', jobId).eq('status', 'approved')) : [],
      p.view_documents ? portalRows(() => db.from('project_documents').select(safeDocumentColumns).eq('project_id', jobId).eq('employee_visible', true).order('created_at', { ascending: false })) : [],
      portalRows(() => db.from('employee_job_notes').select('id,project_id,employee_id,body,created_at').eq('project_id', jobId).eq('owner_id', actor.ownerId).order('created_at', { ascending: false })),
    ]);
    return { job, scope, variations, documents, notes };
  }));
  router.get('/team/bootstrap', portalHandler(async (req, db, actor) => {
    requireTeam(actor);
    const filterJob = req.query.job_id ? paramsId(req.query.job_id) : null;
    const jobs = await portalRows(() => { let q = db.from('projects').select(safeJobColumns).eq('user_id', actor.ownerId); return filterJob ? q.eq('id', filterJob) : q; });
    if (filterJob && !jobs.length) throw new CostApiError(404, 'Job not found.');
    const jobIds = jobs.map(j => j.id);
    const [employees, rates, appointments, assignments, entries, submissions, settings, notes, documents, audit] = await Promise.all([
      portalRows(() => db.from('employees').select(safeEmployeeColumns).eq('owner_id', actor.ownerId).order('name')),
      portalRows(() => db.from('employee_cost_rates').select('employee_id,hourly_rate').eq('owner_id', actor.ownerId)),
      portalRows(() => { let q = db.from('appointments').select('id,project_id,title,date,start_time,end_time,notes').eq('user_id', actor.ownerId); return filterJob ? q.eq('project_id', filterJob) : q; }),
      portalRows(() => { let q = db.from('employee_assignments').select('id,employee_id,project_id,appointment_id').eq('owner_id', actor.ownerId); return filterJob ? q.eq('project_id', filterJob) : q; }),
      portalRows(() => { let q = db.from('employee_time_entries').select(safeEntryColumns).eq('owner_id', actor.ownerId).order('started_at', { ascending: false }); return filterJob ? q.eq('project_id', filterJob) : q; }),
      portalRows(() => db.from('employee_week_submissions').select('id,employee_id,week_start,status,review_comment,submitted_at').eq('owner_id', actor.ownerId).order('week_start', { ascending: false })),
      portalRows(() => db.from('employee_role_permissions').select('role,permissions').eq('owner_id', actor.ownerId)),
      jobIds.length ? portalRows(() => db.from('employee_job_notes').select('id,project_id,employee_id,body,created_at').in('project_id', jobIds).eq('owner_id', actor.ownerId).order('created_at', { ascending: false })) : [],
      jobIds.length ? portalRows(() => db.from('project_documents').select(safeDocumentColumns).in('project_id', jobIds).eq('purpose', 'employee_photo').order('created_at', { ascending: false })) : [],
      portalRows(() => db.from('employee_audit_events').select('id,action,created_at,actor_id,detail,project_id').eq('owner_id', actor.ownerId).order('created_at', { ascending: false })),
    ]);
    return {
      employees: employees.map(e => ({ ...e, hourly_rate: rates.find(r => r.employee_id === e.id)?.hourly_rate ?? null })),
      jobs, appointments, assignments: assignments.flatMap(a => { const ap = appointments.find(p => p.id === a.appointment_id); return ap ? [{ ...a, date: ap.date, start_time: ap.start_time, end_time: ap.end_time, notes: ap.notes, employee_name: employees.find(e => e.id === a.employee_id)?.name }] : []; }),
      entries, submissions: submissions.filter(s => !filterJob || entries.some(e => e.employee_id === s.employee_id && e.work_date >= s.week_start && e.work_date < addDays(s.week_start, 7))).map(s => ({ ...s, employee_name: employees.find(e => e.id === s.employee_id)?.name })),
      permissions: Object.fromEntries(employeeRoles.map(r => [r, { ...defaultPermissions[r], ...(settings.find(s => s.role === r)?.permissions ?? {}) }])),
      timezone: 'Australia/Sydney', notes, documents, audit: audit.filter(a => !filterJob || a.project_id === filterJob),
    };
  }));
  router.get('/employee/reviews', portalHandler(async (_req, db, actor) => {
    const employee = requireEmployee(actor);
    const permissions = await portalPermissions(db, actor.ownerId, employee.role);
    if (!permissions.review_timesheets || !['supervisor','admin'].includes(employee.role)) throw new CostApiError(403, 'Timesheet review is not permitted.');
    const allowedJobs = await assignedJobs(db, actor);
    const submissions = await portalRows(() => db.from('employee_week_submissions').select('id,employee_id,week_start,status,review_comment,submitted_at').eq('owner_id', actor.ownerId).neq('employee_id', employee.id));
    const entries = await portalRows(() => db.from('employee_time_entries').select(safeEntryColumns).eq('owner_id', actor.ownerId));
    const scoped = submissions.filter(s => entries.filter(e => e.employee_id === s.employee_id && e.work_date >= s.week_start && e.work_date < addDays(s.week_start, 7)).every(e => allowedJobs.includes(e.project_id)));
    const scopedEntries = entries.filter(t => scoped.some(s => s.employee_id === t.employee_id && t.work_date >= s.week_start && t.work_date < addDays(s.week_start, 7)));
    const projectIds = [...new Set(scopedEntries.map(e => e.project_id))];
    const staffIds = [...new Set(scoped.map(s => s.employee_id))];
    const [jobs, employees] = await Promise.all([
      projectIds.length ? portalRows(() => db.from('projects').select(safeJobColumns).in('id', projectIds).eq('user_id', actor.ownerId)) : [],
      staffIds.length ? portalRows(() => db.from('employees').select('id,name,role,active').in('id', staffIds).eq('owner_id', actor.ownerId)) : [],
    ]);
    return { submissions: scoped.map(s => ({ ...s, employee_name: employees.find(e => e.id === s.employee_id)?.name })), entries: scopedEntries, jobs, employees: employees.map(e => ({ ...e, email: '' })) };
  }));

  router.post('/team/employees', portalHandler(async (req, db, actor) => {
    requireTeam(actor); return portalMutate(db, actor, 'team_employee', employeeCreate.parse(req.body));
  }));
  router.patch('/team/employees/:id', portalHandler(async (req, db, actor) => {
    requireTeam(actor); return portalMutate(db, actor, 'team_employee', { ...employeeEdit.parse(req.body), id: paramsId(req.params.id) });
  }));
  router.post('/team/employees/:id/invite', portalHandler(async (req, db, actor) => {
    requireTeam(actor);
    if (!process.env.RESEND_API_KEY) throw new CostApiError(503, 'Invitation email is not configured.');
    const token = randomBytes(32).toString('hex');
    const invite = await portalMutate(db, actor, 'team_invite', { employee_id: paramsId(req.params.id), token_hash: hash(token) });
    const base = process.env.VITE_PUBLIC_BASE_URL?.replace(/\/$/, '');
    if (!base || !/^https:\/\//.test(base)) throw new CostApiError(503, 'Set VITE_PUBLIC_BASE_URL to the app’s public HTTPS address before sending invitations.');
    const url = `${base}/employee/accept?token=${token}`;
    const result = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'ScopeClear <onboarding@resend.dev>', to: [invite.email], subject: 'You are invited to the ScopeClear employee portal',
      text: `You have been invited to your employer's ScopeClear employee portal.\n\nAccept your invitation: ${url}\n\nThis invitation expires in 7 days. If you were not expecting it, you can ignore this email.`,
    }) });
    if (!result.ok) throw new CostApiError(502, 'The invitation was created but the email could not be sent. Check your email sender configuration, then resend.');
    return { success: true };
  }));
  router.post('/team/assignments', portalHandler(async (req, db, actor) => {
    requireTeam(actor);
    const body = z.object({ project_id: id, employee_ids: z.array(id).min(1).max(100), appointment_id: id.optional(), date: date.optional(), start_time: time.optional(), end_time: time.optional(), notes: text.optional() }).strict().parse(req.body);
    if (!body.appointment_id && (!body.date || !body.start_time || !body.end_time || body.end_time <= body.start_time)) throw new CostApiError(400, 'Enter the date, start and finish, or select an existing job appointment.');
    return portalMutate(db, actor, 'team_assign', body);
  }));
  router.delete('/team/assignments/:id', portalHandler(async (req, db, actor) => { requireTeam(actor); return portalMutate(db, actor, 'team_unassign', { id: paramsId(req.params.id) }); }));
  router.patch('/team/assignments/:id', portalHandler(async (req, db, actor) => {
    requireTeam(actor);
    const body = z.object({ date, start_time: time, end_time: time, notes: text.optional() }).strict().parse(req.body);
    if (body.end_time <= body.start_time) throw new CostApiError(400, 'Finish must be after start.');
    return portalMutate(db, actor, 'team_reschedule', { ...body, id: paramsId(req.params.id) });
  }));
  router.post('/team/permissions', portalHandler(async (req, db, actor) => { requireTeam(actor); return portalMutate(db, actor, 'team_permissions', z.object({ role: z.enum(employeeRoles), permissions: permissionsSchema }).strict().parse(req.body)); }));
  router.post('/team/jobs/:id', portalHandler(async (req, db, actor) => { requireTeam(actor); return portalMutate(db, actor, 'team_job', { ...z.object({ client_phone: z.string().max(80).nullable(), employee_notes: text.nullable() }).strict().parse(req.body), id: paramsId(req.params.id) }); }));
  router.post('/team/documents/:id/visibility', portalHandler(async (req, db, actor) => { requireTeam(actor); return portalMutate(db, actor, 'team_visibility', { ...z.object({ employee_visible: z.boolean() }).strict().parse(req.body), id: paramsId(req.params.id) }); }));
  router.post('/employee/clock-in', portalHandler(async (req, db, actor) => { requireEmployee(actor); return portalMutate(db, actor, 'clock_in', z.object({ project_id: id, gps }).strict().parse(req.body)); }));
  router.post('/employee/clock-out', portalHandler(async (req, db, actor) => {
    requireEmployee(actor);
    const body = z.object({ entry_id: id, break_minutes: z.number().int().min(0).max(1439).default(0), notes: text.default(''), gps }).strict().parse(req.body);
    return portalMutate(db, actor, 'clock_out', { id: body.entry_id, break_minutes: body.break_minutes, notes: body.notes, gps: body.gps });
  }));
  router.post('/employee/time', portalHandler(async (req, db, actor) => { requireEmployee(actor); return portalMutate(db, actor, 'time_save', timeBody.parse(req.body)); }));
  router.patch('/employee/time/:id', portalHandler(async (req, db, actor) => { requireEmployee(actor); return portalMutate(db, actor, 'time_save', { ...timeBody.parse(req.body), id: paramsId(req.params.id) }); }));
  router.delete('/employee/time/:id', portalHandler(async (req, db, actor) => { requireEmployee(actor); return portalMutate(db, actor, 'time_delete', { id: paramsId(req.params.id) }); }));
  router.post('/employee/submit', portalHandler(async (req, db, actor) => { requireEmployee(actor); return portalMutate(db, actor, 'submit', z.object({ week_start: date }).strict().parse(req.body)); }));
  router.post('/team/review', portalHandler(async (req, db, actor) => {
    const body = z.object({ submission_id: id, decision: z.enum(['approved','rejected','reopen']), comment: text.default('') }).strict().parse(req.body);
    if (actor.setupRequired) requireTeam(actor);
    const { data, error } = await db.rpc('portal_review_week', { p_actor: actor.userId, p_submission: body.submission_id, p_decision: body.decision, p_comment: body.comment });
    portalDbCheck(error); return data;
  }));
  router.post('/employee/notes', portalHandler(async (req, db, actor) => { requireEmployee(actor); return portalMutate(db, actor, 'note', z.object({ project_id: id, body: text.min(1) }).strict().parse(req.body)); }));
  router.post('/employee/notifications/:id/read', portalHandler(async (req, db, actor) => { requireEmployee(actor); return portalMutate(db, actor, 'read_notification', { id: paramsId(req.params.id) }); }));
  router.post('/employee/photos/upload', portalHandler(async (req, db, actor) => {
    const employee = requireEmployee(actor);
    const body = z.object({ job_id: id, file_name: z.string().min(1).max(255), file_type: z.enum(['image/jpeg','image/png','image/webp']), file_size: z.number().int().min(1).max(10 * 1024 * 1024) }).strict().parse(req.body);
    await requireAssigned(db, actor, body.job_id);
    if (!(await portalPermissions(db, actor.ownerId, employee.role)).add_photos) throw new CostApiError(403, 'Photo uploads are not permitted.');
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[body.file_type];
    const path = `${actor.ownerId}/${body.job_id}/${employee.id}/${randomUUID()}.${extension}`;
    const { data, error } = await db.storage.from('employee-photos').createSignedUploadUrl(path);
    if (error || !data) throw new CostApiError(502, 'A private photo upload could not be prepared.');
    return { path, token: data.token };
  }));
  router.post('/employee/photos', portalHandler(async (req, db, actor) => {
    const employee = requireEmployee(actor);
    const body = z.object({ job_id: id, path: z.string().max(500), caption: text.default(''), stage: z.enum(['before','during','after']) }).strict().parse(req.body);
    await requireAssigned(db, actor, body.job_id);
    if (!body.path.startsWith(`${actor.ownerId}/${body.job_id}/${employee.id}/`) || body.path.includes('..')) throw new CostApiError(403, 'Invalid photo path.');
    const { data: photo, error } = await db.storage.from('employee-photos').download(body.path);
    if (error || !photo || photo.size > 10 * 1024 * 1024) throw new CostApiError(400, 'The photo is missing or exceeds 10 MB.');
    const bytes = Buffer.from(await photo.arrayBuffer());
    const mime = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg'
      : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
      : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null;
    if (!mime) throw new CostApiError(400, 'Only valid JPG, PNG or WebP images are accepted.');
    return portalMutate(db, actor, 'photo', { ...body, file_name: body.path.split('/').pop(), file_type: mime, file_size: bytes.length });
  }));
  for (const prefix of ['employee', 'team']) router.get(`/${prefix}/documents/:id/url`, portalHandler(async (req, db, actor) => {
    const documentId = paramsId(req.params.id);
    if (prefix === 'team') requireTeam(actor);
    else { requireEmployee(actor); await requireAssigned(db, actor, (await authorisedEmployeeDocument(db, actor, documentId)).project_id); }
    await (prefix === 'employee' ? authorisedEmployeeDocument(db, actor, documentId) : authorisedDocument(db, actor, documentId));
    return { url: `/api/employee/files/${fileCapability(actor.userId, documentId, prefix === 'employee')}` };
  }));
  router.get('/employee/files/:token', async (req, res) => {
    try {
      const { actorId, documentId, employeeOnly } = verifyFileCapability(String(req.params.token));
      const db = jobCostClient(); const actor = await portalActor(db, actorId);
      // This capability remembers whether it was issued for employee or team
      // access through current document rights; employees still require current
      // assignment for ordinary field roles.
      const doc = await (employeeOnly ? authorisedEmployeeDocument(db, actor, documentId) : authorisedDocument(db, actor, documentId));
      const { bucket, path } = objectPath(doc, actor.ownerId);
      const { data: allowed, error: accessError } = await db.rpc('portal_file_allowed', { p_owner: actor.ownerId, p_job: doc.project_id, p_bucket: bucket, p_path: path });
      portalDbCheck(accessError);
      if (!allowed) throw new CostApiError(403, 'File access denied.');
      const { data, error } = await db.storage.from(bucket).download(path);
      if (error || !data) throw new CostApiError(404, 'The document could not be opened.');
      const inline = ['application/pdf','image/jpeg','image/png','image/webp'].includes(doc.file_type);
      res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': inline ? doc.file_type : 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${String(doc.file_name).replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox" });
      res.send(Buffer.from(await data.arrayBuffer()));
    } catch (error) { portalError(res, error); }
  });
  router.get('/employee/invitations/:token', async (req, res) => {
    try {
      const db = jobCostClient();
      const invite = await validInvitation(db, tokenSchema.parse(req.params.token));
      res.setHeader('Cache-Control', 'no-store');
      res.json({ name: invite.employee.name, email: invite.employee.email, expires_at: invite.expires_at });
    } catch (error) { portalError(res, error); }
  });
  router.post('/employee/invitations/accept', async (req, res) => {
    let createdId: string | null = null;
    const db = jobCostClient();
    try {
      const body = z.object({ token: tokenSchema, password: z.string().min(12).max(128).optional() }).strict().parse(req.body);
      const invite = await validInvitation(db, body.token);
      let userId: string;
      if (req.headers.authorization?.startsWith('Bearer ')) {
        const { data, error } = await db.auth.getUser(req.headers.authorization.slice(7));
        if (error || !data.user || data.user.email?.toLowerCase() !== invite.employee.email) throw new CostApiError(403, 'Sign in with the email address this invitation was sent to.');
        userId = data.user.id;
      } else {
        if (!body.password) throw new CostApiError(400, 'Enter a password of at least 12 characters, or sign in to your existing account.');
        const { data, error } = await db.auth.admin.createUser({ email: invite.employee.email, password: body.password, email_confirm: true });
        if (error || !data.user) throw new CostApiError(409, 'An account may already exist. Sign in with your existing email and password, then accept the invitation.');
        createdId = userId = data.user.id;
      }
      const { data, error } = await db.rpc('portal_accept_invitation', { p_hash: hash(body.token), p_user: userId });
      portalDbCheck(error); createdId = null;
      res.setHeader('Cache-Control', 'no-store'); res.json(data);
    } catch (error) {
      if (createdId) await db.auth.admin.deleteUser(createdId);
      portalError(res, error);
    }
  });
  return router;
}
async function authorisedEmployeeDocument(db: any, actor: PortalActor, documentId: string) {
  // Even Admin-role employees using employee endpoints get employee-only rights.
  const fieldActor = { ...actor, canManageTeam: false };
  return authorisedDocument(db, fieldActor, documentId);
}
async function validInvitation(db: any, token: string) {
  const { data: invite, error } = await db.from('employee_invitations').select('employee_id,expires_at,accepted_at').eq('token_hash', hash(token)).maybeSingle();
  portalDbCheck(error);
  if (!invite || invite.accepted_at || Date.parse(invite.expires_at) <= Date.now()) throw new CostApiError(403, 'Invitation is invalid or expired. Ask your employer to send a new invitation.');
  const { data: employee, error: ee } = await db.from('employees').select('id,name,email,active').eq('id', invite.employee_id).single();
  portalDbCheck(ee);
  if (!employee?.active) throw new CostApiError(403, 'This invitation is no longer active.');
  return { ...invite, employee };
}
function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
