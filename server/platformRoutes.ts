import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z, ZodError } from 'zod';
import { jobCostClient } from './jobCostAccess';
import { businessDetail, loadDirectory } from './platformDirectory';
import { configuredAdminEmail, platformReady, platformReleaseReady, platformBuild, releaseMessage, PlatformError, requirePlatformAdmin, setupMessage } from './platformAccess';
import { deletePlatformIdentity, deletionReady, deletionSetupMessage } from './platformDeletion';
import { deliverPlatformRecovery, RecoveryDeliveryError } from './platformRecovery';

const idSchema = z.string().uuid();
const actionSchema = z.object({
  action: z.enum(['suspend', 'reactivate', 'archive', 'password_reset']),
  reason: z.string().trim().min(5).max(500),
  confirmation: z.string().trim().min(1).max(320),
}).strict();
const removalSchema = actionSchema.omit({ action: true });
function checked(error: any) {
  if (error) throw new PlatformError(error.code === '42501' ? 403 : error.code === 'P0001' ? 409 : 503,
    error.code === 'P0001' ? error.message : 'The administrator action could not be completed.');
}
export function createPlatformRouter(client: () => SupabaseClient = jobCostClient, releaseReady: () => Promise<boolean> = platformReleaseReady, recover: typeof deliverPlatformRecovery = deliverPlatformRecovery) {
  const router = Router();
  router.get('/platform/version', (_req, res) => { res.set('Cache-Control', 'no-store').json({ build: platformBuild }); });
  const handle = (fn: (req: any, db: SupabaseClient, actor: any) => Promise<any>) => async (req: any, res: any) => {
    res.set('Cache-Control', 'no-store');
    try {
      const db = client(), actor = await requirePlatformAdmin(db, req.headers.authorization);
      res.json(await fn(req, db, actor));
    } catch (e) {
      res.status(e instanceof PlatformError ? e.status : e instanceof ZodError ? 400 : 500)
        .json({ error: e instanceof PlatformError ? e.message : e instanceof ZodError ? 'Check the account, confirmation and reason.' : 'System administration is temporarily unavailable.' });
    }
  };
  router.get('/platform/session', handle(async () => ({ admin: true })));
  router.get('/platform/directory', handle(async (_req, db) => {
    const { directory } = await loadDirectory(db);
    if (directory.ready && !await releaseReady()) { directory.ready = false; directory.setupMessage = releaseMessage; }
    directory.deletionReady = directory.ready && await deletionReady(db);
    if (!directory.deletionReady) directory.deletionSetupMessage = directory.ready ? deletionSetupMessage : directory.setupMessage;
    return directory;
  }));
  router.post('/platform/:collection/:id/delete', handle(async (req, db, actor) => {
    await ready(db);
    const kind = req.params.collection === 'accounts' ? 'account' : req.params.collection === 'businesses' ? 'business' : null;
    if (!kind) throw new PlatformError(400, 'Unsupported deletion target.');
    return deletePlatformIdentity(db, actor.id, kind, idSchema.parse(req.params.id), removalSchema.parse(req.body));
  }));
  router.get('/platform/businesses/:id', handle(async (req, db) => businessDetail(db, idSchema.parse(req.params.id))));
  router.get('/platform/audit', handle(async (_req, db) => {
    if (!await platformReady(db)) return { ready: false, events: [], setupMessage };
    const { data, error } = await db.from('platform_admin_audit').select('id,actor_id,target_kind,target_id,action,reason,outcome,created_at').order('created_at', { ascending: false }).limit(200);
    checked(error); return { ready: true, events: data };
  }));
  async function ready(db: SupabaseClient) {
    if (!await platformReady(db)) throw new PlatformError(503, setupMessage);
    if (!await releaseReady()) throw new PlatformError(503, releaseMessage);
  }
  router.post('/platform/:collection/:id/action', handle(async (req, db, actor) => {
    await ready(db);
    const target = idSchema.parse(req.params.id), input = actionSchema.parse(req.body);
    const kind = req.params.collection === 'accounts' ? 'account' : req.params.collection === 'businesses' ? 'business' : null;
    if (!kind || (kind === 'business' && input.action === 'password_reset')) throw new PlatformError(400, 'Unsupported administrator action.');
    const { data: controls, error: controlError } = await db.from('platform_controls').select('*').eq('kind', kind).eq('target_id', target);
    checked(controlError);
    if (controls?.some(c => c.deletion_state)) throw new PlatformError(409, 'Deletion has started. Retry deletion instead of resetting or changing this access.');
    if (input.action !== 'password_reset') {
      const { error } = await db.rpc('platform_change_access', {
        p_actor: actor.id, p_admin_email: configuredAdminEmail(), p_kind: kind,
        p_target: target, p_action: input.action, p_reason: input.reason, p_confirmation: input.confirmation,
      });
      if (error) {
        const { error: auditError } = await db.rpc('platform_record_event', {
          p_actor: actor.id, p_kind: kind, p_target: target, p_action: input.action,
          p_reason: input.reason, p_outcome: ['P0001', '42501'].includes(error.code) ? 'failed' : 'unconfirmed',
        });
        checked(auditError);
      }
      checked(error);
      return { success: true, message: input.action === 'reactivate' ? 'App access restored. Separately removed team access and provider restrictions are unchanged.' : 'App access restricted. Business and work history is retained. Previously issued file URLs remain valid until their original provider expiry; older image links can last up to 24 hours.' };
    }
    const { data: account, error: ae } = await db.auth.admin.getUserById(target);
    if (ae || !account.user?.email) throw new PlatformError(404, 'Sign-in account not found.');
    if (input.confirmation.toLowerCase() !== account.user.email.toLowerCase()) throw new PlatformError(400, 'Type the account email to confirm.');
    const { count, error: rateError } = await db.from('platform_admin_audit').select('id', { count: 'exact', head: true })
      .eq('target_id', target).eq('action', 'password_reset').gte('created_at', new Date(Date.now() - 300000).toISOString());
    checked(rateError);
    if ((count || 0) >= 3) throw new PlatformError(429, 'A password reset was recently requested. Wait five minutes before retrying.');
    let base: URL;
    try { base = new URL(process.env.VITE_PUBLIC_BASE_URL || ''); }
    catch { throw new PlatformError(503, 'A secure public app address must be configured for password recovery.'); }
    if (base.protocol !== 'https:') throw new PlatformError(503, 'A secure public app address must be configured for password recovery.');
    const { data: event, error: logError } = await db.rpc('platform_record_event', {
      p_actor: actor.id, p_kind: 'account', p_target: target, p_action: 'password_reset', p_reason: input.reason, p_outcome: 'started',
    });
    checked(logError);
    let outcome = 'unconfirmed';
    try {
      await recover(db, account.user.email, new URL('/reset-password', base).href, event);
      outcome = 'accepted';
    } catch (error) {
      outcome = error instanceof RecoveryDeliveryError ? error.outcome : 'unconfirmed';
      throw error;
    } finally {
      const { error } = await db.rpc('platform_finish_event', { p_id: event, p_outcome: outcome });
      if (error) throw new PlatformError(503, 'The reset request outcome could not be recorded. Check the audit log before retrying.');
    }
    return { success: true, message: 'Password-reset email request accepted. This does not confirm inbox delivery. The user chooses their new password.' };
  }));
  router.post('/platform/memberships/:id/remove', handle(async (req, db, actor) => {
    await ready(db);
    const input = removalSchema.parse(req.body);
    const { error } = await db.rpc('platform_remove_membership', {
      p_actor: actor.id, p_admin_email: configuredAdminEmail(), p_member: idSchema.parse(req.params.id),
      p_reason: input.reason, p_confirmation: input.confirmation,
    });
    if (error) {
      const { error: auditError } = await db.rpc('platform_record_event', {
        p_actor: actor.id, p_kind: 'membership', p_target: req.params.id, p_action: 'remove',
        p_reason: input.reason, p_outcome: ['P0001', '42501'].includes(error.code) ? 'failed' : 'unconfirmed',
      });
      checked(auditError);
    }
    checked(error);
    return { success: true, message: 'Team access removed and invitations expired. Work history, jobs and sign-in account retained.' };
  }));
  return router;
}
