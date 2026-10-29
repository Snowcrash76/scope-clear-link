import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CostApiError, jobCostClient } from './jobCostAccess';
import { portalActor, portalDbCheck, portalError, portalHandler } from './employeeAccess';

type Scope = { project: any; quoteId?: string; projectToken?: string; quoteToken?: string };
const uuid = z.string().uuid();
export async function clientScope(req: Request, db: any): Promise<Scope> {
  const projectToken = req.get('X-Client-Project-Token') || (typeof req.query.access === 'string' ? req.query.access : undefined);
  const quoteToken = req.get('X-Client-Quote-Token') || (typeof req.query.quote_access === 'string' ? req.query.quote_access : undefined);
  if (projectToken && uuid.safeParse(projectToken).success) {
    const { data, error } = await db.from('projects').select('id,user_id,client_access_token').eq('client_access_token', projectToken).maybeSingle();
    portalDbCheck(error);
    if (data) return { project: data, projectToken };
  }
  if (quoteToken && uuid.safeParse(quoteToken).success) {
    const { data: quote, error } = await db.from('quotes').select('id,project_id').eq('quote_token', quoteToken).maybeSingle(); portalDbCheck(error);
    if (quote) {
      const { data: project, error: pe } = await db.from('projects').select('id,user_id').eq('id', quote.project_id).single(); portalDbCheck(pe);
      if (project) return { project, quoteId: quote.id, quoteToken };
    }
  }
  throw new CostApiError(403, 'This client link is invalid or has been replaced. Ask your trade for a new secure link.');
}
function tokenQuery(scope: Scope) {
  return scope.projectToken ? `access=${encodeURIComponent(scope.projectToken)}` : `quote_access=${encodeURIComponent(scope.quoteToken!)}`;
}
const projectTables = ['scope_items','change_requests','project_stages','project_documents','quotes','invoices'];
export const clientReadableTables = ['projects','profiles',...projectTables,'quote_line_items','invoice_line_items','quote_line_item_history'];
export function validateClientSelect(value: string | null): string {
  if (!value || value === '*') return '*';
  if (!/^[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*$/i.test(value)) throw new CostApiError(400, 'Unsupported client data selection.');
  return value;
}
export function validateClientPatch(table: string, body: any) {
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new CostApiError(400, 'Invalid client update.');
  const allowed: Record<string, string[]> = {
    quotes: ['status','approved_at','declined_at','client_comment'],
    projects: ['status'], scope_items: ['acknowledged'],
    change_requests: ['status','resolved_at','resolution_comment'],
  };
  if (!allowed[table] || Object.keys(body).some(k => !allowed[table].includes(k))) throw new CostApiError(403, 'This field cannot be changed from the client portal.');
  if (table === 'quotes' && !['approved','declined'].includes(body.status)) throw new CostApiError(400, 'Invalid quote response.');
  if (table === 'projects' && body.status !== 'in_progress') throw new CostApiError(400, 'Invalid project response.');
  if (table === 'scope_items' && typeof body.acknowledged !== 'boolean') throw new CostApiError(400, 'Invalid acknowledgment.');
  if (table === 'change_requests' && !['approved','declined'].includes(body.status)) throw new CostApiError(400, 'Invalid variation response.');
}
function applyFilters(query: any, search: URLSearchParams) {
  for (const [key, value] of search) {
    if (['select','order','limit','offset'].includes(key)) continue;
    if (!/^[a-z_][a-z0-9_]*$/i.test(key)) throw new CostApiError(400, 'Unsupported client filter.');
    const dot = value.indexOf('.'), op = value.slice(0, dot), raw = value.slice(dot + 1);
    if (!['eq','neq','gt','gte','lt','lte','is','in'].includes(op)) throw new CostApiError(400, 'Unsupported client filter.');
    if (op === 'in') {
      if (!/^\([a-z0-9,_-]*\)$/i.test(raw)) throw new CostApiError(400, 'Invalid client filter.');
      query = query.in(key, raw.slice(1,-1).split(','));
    } else query = query.filter(key, op, raw);
  }
  return query;
}
async function constrain(query: any, table: string, scope: Scope, db: any) {
  const pid = scope.project.id;
  if (table === 'projects') return { query: query.eq('id', pid) };
  if (table === 'profiles') return { query: query.eq('user_id', scope.project.user_id) };
  if (scope.quoteId && ['invoices','invoice_line_items','project_documents','project_stages'].includes(table)) throw new CostApiError(403, 'Use the secure project link to access this section.');
  if (projectTables.includes(table)) {
    query = query.eq('project_id', pid);
    if (table === 'project_documents') query = query.neq('purpose','employee_photo');
    if (table === 'quotes' && scope.quoteId) query = query.eq('id',scope.quoteId);
    return { query };
  }
  const parent = table === 'invoice_line_items' ? 'invoices' : 'quotes';
  let parentQuery = db.from(parent).select('id').eq('project_id', pid);
  if (scope.quoteId) parentQuery = parentQuery.eq('id',scope.quoteId);
  const { data, error } = await parentQuery; portalDbCheck(error);
  return { query: query.in(parent === 'invoices' ? 'invoice_id' : 'quote_id', data?.length ? data.map((r: any) => r.id) : ['00000000-0000-0000-0000-000000000000']) };
}
function cleanClientRows(table: string, data: any[], scope: Scope) {
  return data.map(row => {
    const copy = { ...row };
    if (table === 'projects') { delete copy.client_access_token; delete copy.employee_notes; }
    if (table === 'project_documents' && row.file_url) {
      copy.file_url = `/api/client/files/project_documents/${row.id}/file_url?${tokenQuery(scope)}`;
    }
    if (['scope_items','change_requests'].includes(table)) {
      if (row.image_url) copy.image_url = `/api/client/files/${table}/${row.id}/image_url?${tokenQuery(scope)}`;
      if (Array.isArray(row.image_urls)) copy.image_urls = row.image_urls.map((_url: string, index: number) => `/api/client/files/${table}/${row.id}/image_urls?index=${index}&${tokenQuery(scope)}`);
    }
    return copy;
  });
}
export function createClientAccessRouter() {
  const router = Router();
  router.post('/client/images/upload-url', async(req,res)=>{
    try {
      const db=jobCostClient(),scope=await clientScope(req,db);
      if(!scope.projectToken)throw new CostApiError(403,'Use your secure project link to upload an image.');
      const body=z.object({file_type:z.enum(['image/jpeg','image/png','image/webp']),file_size:z.number().int().positive().max(10*1024*1024)}).strict().parse(req.body);
      const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[body.file_type];
      const path=`${scope.project.id}/client-${randomUUID()}.${ext}`;
      const {data,error}=await db.storage.from('scope-images').createSignedUploadUrl(path);
      if(error||!data)throw new CostApiError(502,'The image upload could not be prepared.');
      const {data:link}=db.storage.from('scope-images').getPublicUrl(path);
      res.setHeader('Cache-Control','no-store');res.json({path,token:data.token,url:link.publicUrl});
    }catch(error){portalError(res,error);}
  });
  router.get('/client/images/preview',async(req,res)=>{
    try {
      const db=jobCostClient(),scope=await clientScope(req,db);
      const path=z.string().max(1000).parse(req.query.path);
      const {data:allowed,error:ae}=await db.rpc('portal_file_allowed',{p_owner:scope.project.user_id,p_job:scope.project.id,p_bucket:'scope-images',p_path:path});
      portalDbCheck(ae);if(!allowed)throw new CostApiError(403,'Image access denied.');
      const {data,error}=await db.storage.from('scope-images').download(path);
      if(error||!data||!['image/jpeg','image/png','image/webp'].includes(data.type))throw new CostApiError(404,'Image unavailable.');
      res.set({'Cache-Control':'private, no-store','Content-Type':data.type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'});
      res.send(Buffer.from(await data.arrayBuffer()));
    }catch(error){portalError(res,error);}
  });
  router.get('/team/jobs/:id/client-link', portalHandler(async (req, db, actor) => {
    // Business employee Admin is NOT the owner and does not get a financial
    // client capability through the otherwise operational team API.
    if (actor.employee) throw new CostApiError(403, 'Only the business owner can share the client financial portal.');
    const { data, error } = await db.from('projects').select('id,client_access_token').eq('id', uuid.parse(req.params.id)).eq('user_id', actor.userId).maybeSingle();
    portalDbCheck(error);
    if (!data) throw new CostApiError(404, 'Job not found.');
    return { path: `/project/${data.id}?access=${data.client_access_token}` };
  }));
  router.all('/client/data/:table', async (req, res) => {
    try {
      const table = String(req.params.table);
      if (!clientReadableTables.includes(table) || !['GET','HEAD','PATCH','POST'].includes(req.method)) throw new CostApiError(403, 'Client data access denied.');
      const db = jobCostClient(), scope = await clientScope(req, db);
      const search = new URL(req.originalUrl, 'https://internal.invalid').searchParams;
      const select = validateClientSelect(search.get('select'));
      let query: any;
      if (req.method === 'PATCH') {
        validateClientPatch(table, req.body);
        if (!search.has('id')) throw new CostApiError(400, 'Select a specific record.');
        // Authoritative database timestamps; client dates are never trusted.
        const body = { ...req.body };
        if (table === 'quotes') {
          body.client_comment = z.string().max(5000).nullable().optional().parse(body.client_comment) ?? null;
          delete body.approved_at; delete body.declined_at;
          body[body.status === 'approved' ? 'approved_at' : 'declined_at'] = new Date().toISOString();
        }
        if (table === 'change_requests') { body.resolved_at = new Date().toISOString(); body.resolution_comment = z.string().max(5000).nullable().optional().parse(body.resolution_comment) ?? null; }
        query = db.from(table).update(body).select(select);
        if (table === 'quotes') query = query.eq('status','sent');
        if (table === 'change_requests') query = query.in('status',['pending','awaiting_client']);
      } else if (req.method === 'POST') {
        if (table !== 'change_requests') throw new CostApiError(403, 'This client action is not permitted.');
        const body = z.object({
          project_id: uuid, type: z.literal('client_request'), title: z.string().trim().min(1).max(200),
          description: z.string().max(10000), reason: z.string().max(5000).nullable().optional(),
          cost_impact: z.number().min(0).max(100000000).nullable().optional(), time_impact: z.string().max(200).nullable().optional(),
          related_scope_item_id: uuid.optional(), related_quote_line_item_id: uuid.optional(),
          image_url: z.string().max(1500).nullable().optional(),
        }).strict().parse(req.body);
        if (body.project_id !== scope.project.id) throw new CostApiError(403, 'Wrong project.');
        if (body.related_scope_item_id) {
          const { data, error } = await db.from('scope_items').select('id').eq('id',body.related_scope_item_id).eq('project_id',scope.project.id).maybeSingle();
          portalDbCheck(error); if (!data) throw new CostApiError(403,'Scope item does not belong to this project.');
        }
        if (body.related_quote_line_item_id) {
          const { data, error } = await db.from('quote_line_items').select('quote_id').eq('id',body.related_quote_line_item_id).maybeSingle(); portalDbCheck(error);
          const { data: quote, error: qe } = await db.from('quotes').select('id').eq('id',data?.quote_id ?? '00000000-0000-0000-0000-000000000000').eq('project_id',scope.project.id).maybeSingle();
          portalDbCheck(qe); if (!quote) throw new CostApiError(403,'Quote item does not belong to this project.');
        }
        query = db.from(table).insert({ ...body, status: 'pending' }).select(select);
      } else query = db.from(table).select(select);
      query = (await constrain(query, table, scope, db)).query;
      query = applyFilters(query, search);
      const order = search.get('order');
      if (order) for (const part of order.split(',')) {
        const [column, direction] = part.split('.');
        if (!/^[a-z_][a-z0-9_]*$/i.test(column) || !['asc','desc',undefined].includes(direction)) throw new CostApiError(400,'Invalid sort.');
        query = query.order(column,{ ascending: direction !== 'desc' });
      }
      const offset = Number(search.get('offset') || 0), limit = Number(search.get('limit') || 1000);
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new CostApiError(400,'Invalid page.');
      if (['GET','HEAD'].includes(req.method)) query = query.range(offset,offset+limit-1);
      const { data, error } = await query; portalDbCheck(error);
      if (req.method === 'PATCH' && (!data || !data.length)) throw new CostApiError(409, 'This record has already changed. Refresh the page.');
      const rows = cleanClientRows(table, data ?? [], scope);
      res.set({ 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer' });
      if (req.get('Accept')?.includes('application/vnd.pgrst.object+json')) {
        if (rows.length !== 1) return res.status(406).json({ code:'PGRST116', message:'Record not found' });
        return res.json(rows[0]);
      }
      res.json(rows);
    } catch (error) { portalError(res, error); }
  });
  router.post('/client/data/rpc/respond_to_quote_by_token', async (req, res) => {
    try {
      const db = jobCostClient(), scope = await clientScope(req, db);
      const body = z.object({ p_token: uuid, p_status: z.enum(['approved','declined']), p_comment: z.string().max(5000).nullable().optional() }).strict().parse(req.body);
      const { data: quote, error: qe } = await db.from('quotes').select('id').eq('quote_token', body.p_token).eq('project_id', scope.project.id).maybeSingle(); portalDbCheck(qe);
      if (!quote || scope.quoteId && quote.id !== scope.quoteId) throw new CostApiError(403,'Quote access denied.');
      const { data, error } = await db.rpc('respond_to_quote_by_token', body); portalDbCheck(error);
      res.setHeader('Cache-Control','no-store'); res.json(data);
    } catch (error) { portalError(res,error); }
  });
  router.get('/client/files/:table/:id/:field', async (req,res) => {
    try {
      const table = String(req.params.table), field = String(req.params.field);
      if (!['project_documents','scope_items','change_requests'].includes(table) || !['file_url','image_url','image_urls'].includes(field) ||
        table === 'project_documents' && field !== 'file_url' || table !== 'project_documents' && field === 'file_url') throw new CostApiError(403,'File access denied.');
      const db = jobCostClient(), scope = await clientScope(req,db);
      if (scope.quoteId && table === 'project_documents') throw new CostApiError(403,'Use your project link.');
      let q = db.from(table).select('*').eq('id',uuid.parse(req.params.id)).eq('project_id',scope.project.id);
      if (table === 'project_documents') q = q.neq('purpose','employee_photo');
      const { data: row, error } = await q.maybeSingle(); portalDbCheck(error);
      if (!row) throw new CostApiError(404,'File not found.');
      let path = field === 'image_urls' ? row.image_urls?.[Number(req.query.index)] : row[field];
      const bucket = table === 'project_documents' ? 'project-documents' : 'scope-images';
      if (typeof path !== 'string') throw new CostApiError(404,'File not found.');
      if (path.includes(`/storage/v1/object/`)) path = decodeURIComponent(path.split(`/${bucket}/`)[1]?.split('?')[0] || '');
      const { data: allowed, error: ae } = await db.rpc('portal_file_allowed', { p_owner: scope.project.user_id, p_job: scope.project.id, p_bucket: bucket, p_path: path });
      portalDbCheck(ae); if (!allowed) throw new CostApiError(403,'File access denied.');
      const { data: blob, error: se } = await db.storage.from(bucket).download(path);
      if (se || !blob) throw new CostApiError(404,'File could not be loaded.');
      res.set({ 'Cache-Control':'private, no-store', 'Content-Type':blob.type || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'none'; sandbox" });
      if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(blob.type)) res.setHeader('Content-Disposition','attachment');
      res.send(Buffer.from(await blob.arrayBuffer()));
    } catch (error) { portalError(res,error); }
  });
  return router;
}
/** Protect older public upload/email endpoints too; otherwise knowing a job ID
 * would still mint private upload capabilities or trigger client actions. */
export async function requireOwnerOrClient(req: Request,res: Response,next: NextFunction) {
  try {
    const db = jobCostClient(); let jobId = req.body?.projectId;
    if (!jobId && req.body?.quoteId) {
      const { data, error } = await db.from('quotes').select('project_id').eq('id',uuid.parse(req.body.quoteId)).maybeSingle(); portalDbCheck(error); jobId=data?.project_id;
    }
    if (!uuid.safeParse(jobId).success) throw new CostApiError(400,'A valid project is required.');
    if (req.headers.authorization?.startsWith('Bearer ')) {
      const { data:{ user },error } = await db.auth.getUser(req.headers.authorization.slice(7));
      if (!error && user) {
        const actor = await portalActor(db,user.id);
        if (!actor.employee) {
          const { data, error: pe } = await db.from('projects').select('id').eq('id',jobId).eq('user_id',user.id).maybeSingle(); portalDbCheck(pe);
          if (data) return next();
        }
      }
    }
    const scope = await clientScope(req,db);
    if (scope.project.id !== jobId) throw new CostApiError(403,'Client project access denied.');
    if (req.path.includes('upload') || req.path.includes('record-client-document')) {
      if (!scope.projectToken) throw new CostApiError(403,'A secure project link is required for uploads.');
      if (req.body.filePath && (typeof req.body.filePath !== 'string' || !req.body.filePath.startsWith(`${jobId}/`) || req.body.filePath.includes('..'))) throw new CostApiError(403,'Invalid upload path.');
    }
    next();
  } catch(error) { portalError(res,error); }
}
