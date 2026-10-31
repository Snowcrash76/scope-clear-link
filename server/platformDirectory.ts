import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { PlatformDirectory, PlatformControl, PlatformBusinessDetail } from '../shared/platformAdmin';
import { configuredAdminEmail, platformReady, PlatformError, setupMessage } from './platformAccess';

async function rows(db: SupabaseClient, table: string, columns: string) {
  const result: any[] = [];
  for (let page = 0; page < 200; page++) {
    let query = db.from(table).select(columns).order(table === 'platform_controls' ? 'kind' : 'id');
    if (table === 'platform_controls') query = query.order('target_id');
    const { data, error } = await query.range(page * 500, page * 500 + 499);
    if (error) throw new PlatformError(503, `Could not load ${table.replaceAll('_', ' ')}. No partial directory is shown.`);
    result.push(...data);
    if (data.length < 500) return result;
  }
  throw new PlatformError(503, 'The directory exceeds the supported size. No partial results are shown.');
}
export async function authenticationUsers(db: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= 500; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new PlatformError(503, 'Sign-in accounts could not be loaded.');
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
  throw new PlatformError(503, 'The account directory exceeds the supported size. No partial results are shown.');
}
export function composeDirectory(input: {
  users: any[]; profiles: any[]; employees: any[]; projects: any[];
  quotes: any[]; invoices: any[]; invitations: any[]; controls: any[]; ready: boolean;
}): PlatformDirectory {
  const { users, profiles, employees, projects, quotes, invoices, invitations, controls, ready } = input;
  const control = (kind: string, id: string): PlatformControl => {
    const found = controls.find(c => c.kind === kind && c.target_id === id);
    return found ? { status: found.status, reason: found.reason, updated_at: found.updated_at } : { status: 'active', reason: '' };
  };
  const profile = new Map(profiles.map(p => [p.user_id, p]));
  const userMap = new Map(users.map(u => [u.id, u]));
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const employeeIds = new Set(employees.flatMap(e => [e.auth_user_id, ...(e.revoked_auth_user_ids || [])]).filter(Boolean));
  const ownerIds = new Set<string>([
    ...projects.map(p => p.user_id), ...employees.map(e => e.owner_id),
    ...profiles.filter(p => p.business_name?.trim() && !employeeIds.has(p.user_id)).map(p => p.user_id),
  ]);
  const memberships = employees.map(e => {
    const latest = invitations.filter(i => i.employee_id === e.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      id: e.id, ownerId: e.owner_id, name: e.name, email: e.email, role: e.role,
      active: !!e.active, removed: !!e.archived_at, accountId: e.auth_user_id || null,
      invitation: (e.auth_user_id || latest?.accepted_at ? 'accepted' : latest ? (Date.parse(latest.expires_at) <= Date.now() ? 'expired' : 'pending') : 'not_invited') as 'accepted' | 'pending' | 'expired' | 'not_invited',
    };
  });
  return {
    ready, ...(ready ? {} : { setupMessage }), deletionPolicy: 'history_preserving_only',
    accounts: users.map(u => ({
      id: u.id, email: u.email || '', name: profile.get(u.id)?.contact_name || '',
      createdAt: u.created_at, lastSignInAt: u.last_sign_in_at || null,
      emailConfirmed: !!u.email_confirmed_at,
      systemAdmin: !!u.email && u.email.trim().toLowerCase() === configuredAdminEmail(),
      providerBanned: !!u.banned_until && Date.parse(u.banned_until) > Date.now(),
      control: control('account', u.id), businessIds: ownerIds.has(u.id) ? [u.id] : [],
      membershipIds: memberships.filter(e => e.accountId === u.id).map(e => e.id),
    })),
    businesses: [...ownerIds].map(id => {
      const p = profile.get(id), u = userMap.get(id);
      return {
        id, name: p?.business_name?.trim() || p?.contact_name?.trim() || u?.email || 'Business profile unavailable',
        email: u?.email || p?.email || '', contact: p?.contact_name || null,
        phone: p?.phone || null, abn: p?.abn || null, address: p?.business_address || null, website: p?.website || null,
        createdAt: p?.created_at || u?.created_at || null, lastSignInAt: u?.last_sign_in_at || null,
        control: control('business', id), systemAdmin: !!u?.email && u.email.trim().toLowerCase() === configuredAdminEmail(),
        loginExists: !!u, memberCount: employees.filter(e => e.owner_id === id && e.active && !e.archived_at).length,
        projectCount: projects.filter(p => p.user_id === id).length,
        quoteCount: quotes.filter(q => projectMap.get(q.project_id)?.user_id === id).length,
        invoiceCount: invoices.filter(i => projectMap.get(i.project_id)?.user_id === id).length,
      };
    }),
    memberships,
  };
}
export async function loadDirectory(db: SupabaseClient) {
  const ready = await platformReady(db);
  const [users, profiles, employees, projects, quotes, invoices, invitations, controls] = await Promise.all([
    authenticationUsers(db), rows(db, 'profiles', '*'),
    rows(db, 'employees', 'id,owner_id,auth_user_id,revoked_auth_user_ids,name,email,role,active,archived_at'),
    rows(db, 'projects', 'id,name,user_id,status,created_at'),
    rows(db, 'quotes', 'id,project_id'), rows(db, 'invoices', 'id,project_id'),
    rows(db, 'employee_invitations', 'id,employee_id,created_at,expires_at,accepted_at'),
    ready ? rows(db, 'platform_controls', 'kind,target_id,status,reason,updated_at') : [],
  ]);
  return { directory: composeDirectory({ users, profiles, employees, projects, quotes, invoices, invitations, controls, ready }), projects };
}
export async function businessDetail(db: SupabaseClient, id: string): Promise<PlatformBusinessDetail> {
  const { directory, projects } = await loadDirectory(db);
  const business = directory.businesses.find(b => b.id === id);
  if (!business) throw new PlatformError(404, 'Business not found.');
  return {
    business, memberships: directory.memberships.filter(m => m.ownerId === id),
    projects: projects.filter(p => p.user_id === id).map(({ id, name, status, created_at }) => ({ id, name, status, created_at })),
  };
}
