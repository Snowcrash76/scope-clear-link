import { useState, useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Users, FolderOpen, FileText, Receipt, TicketCheck,
  Copy, Plus, Trash2, Loader2, UserCheck,
  TrendingUp, Building2, Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { InviteCodeSetupHelp } from '@/components/InviteCodeSetupHelp';
import { PageLayout } from '@/components/PageLayout';
import { LoadErrorState } from '@/components/LoadErrorState';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

const VALID_TABS = ['overview', 'users', 'invites', 'activity'] as const;
type TabKey = typeof VALID_TABS[number];

interface AdminStats {
  totalUsers: number;
  projectsByStatus: Record<string, number>;
  quotesSent: number;
  quotesApproved: number;
  invoicesPaid: number;
  totalRevenue: number;
  unusedInviteCodes: number;
}

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  business_name: string | null;
  contact_name: string | null;
  created_at: string;
  projectCount: number;
}

interface ActivityEvent {
  type: 'signup' | 'project';
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
}

interface InviteCode {
  id: string;
  code: string;
  label: string | null;
  used_by_email: string | null;
  used_at: string | null;
  created_at: string;
}

async function adminFetch(path: string, options?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <Card className="p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-heading mt-0.5" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

// ─── Overview tab ───────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: stats, isLoading, isError, refetch } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    queryFn: () => adminFetch('/api/admin/stats'),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  if (isError) return <LoadErrorState title="Admin overview could not be loaded" onRetry={refetch} />;
  if (!stats) return null;

  const p = stats.projectsByStatus;
  const totalProjects = Object.values(p).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Registered users" value={stats.totalUsers} icon={Users} />
        <StatCard label="Total projects" value={totalProjects} icon={FolderOpen}
          sub={[p.in_progress && `${p.in_progress} active`, p.completed && `${p.completed} completed`].filter(Boolean).join(' · ') || undefined} />
        <StatCard label="Quotes sent" value={stats.quotesSent} icon={FileText}
          sub={`${stats.quotesApproved} approved`} />
        <StatCard label="Invoices paid" value={stats.invoicesPaid} icon={Receipt} />
        <StatCard label="Revenue tracked" value={`$${stats.totalRevenue.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={TrendingUp}
          sub="Paid invoices only" />
        <StatCard label="Invite codes available" value={stats.unusedInviteCodes} icon={TicketCheck} />
      </div>

      {totalProjects > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">Projects by status</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { key: 'draft', label: 'Draft' },
              { key: 'sent', label: 'Sent' },
              { key: 'in_progress', label: 'In progress' },
              { key: 'completed', label: 'Completed' },
            ].map(({ key, label }) => (
              p[key] ? (
                <div key={key} className="flex items-center gap-2">
                  <Badge variant="secondary">{p[key]}</Badge>
                  <span className="text-sm text-muted-foreground">{label}</span>
                </div>
              ) : null
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Users tab ──────────────────────────────────────────────────────────────────
function UsersTab() {
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading, isError, refetch } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    queryFn: () => adminFetch('/api/admin/users'),
  });

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.business_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.contact_name?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-users"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : isError ? (
        <LoadErrorState title="Users could not be loaded" onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {search ? 'No users match that search.' : 'No registered users yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => (
            <Card key={user.id} className="p-4 flex items-center justify-between gap-4" data-testid={`row-user-${user.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{user.business_name || user.contact_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 text-right">
                <div className="hidden sm:block">
                  <p className="text-sm font-medium">{user.projectCount}</p>
                  <p className="text-xs text-muted-foreground">{user.projectCount === 1 ? 'project' : 'projects'}</p>
                </div>
                <div className="hidden md:block">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm">{format(new Date(user.created_at), 'dd MMM yyyy')}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">{filtered.length} of {users.length} users</p>
      )}
    </div>
  );
}

// ─── Invite codes tab ───────────────────────────────────────────────────────────
function InviteCodesTab() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [label, setLabel] = useState('');
  const [count, setCount] = useState(1);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { data: codes = [], isLoading, error, refetch } = useQuery<InviteCode[]>({
    queryKey: ['/api/admin/invites'],
    queryFn: () => adminFetch('/api/admin/invites'),
    retry: false,
  });

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleGenerate = async () => {
    setGenerateError(null);
    setGenerating(true);
    try {
      const rows = Array.from({ length: count }, () => ({
        code: generateCode(),
        label: label.trim() || null,
      }));
      await adminFetch('/api/admin/invites', {
        method: 'POST',
        body: JSON.stringify({ codes: rows }),
      });
      toast.success(`${count} invite code${count > 1 ? 's' : ''} created`);
      setLabel('');
      setCount(1);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/invites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create codes';
      setGenerateError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminFetch(`/api/admin/invites/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/invites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast.success('Code deleted');
    } catch {
      toast.error('Failed to delete code');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied');
  };

  const unused = codes.filter(c => !c.used_at);
  const used = codes.filter(c => c.used_at);
  const errorMessage = generateError || (error instanceof Error ? error.message : null);
  const setupRequired = errorMessage?.includes('Invite codes need database setup');

  return (
    <div className="space-y-6">
      {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
      {setupRequired && <InviteCodeSetupHelp onRetry={() => { setGenerateError(null); void refetch(); }} />}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Generate new codes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="invite-label">Label (optional)</Label>
            <Input
              id="invite-label"
              placeholder="e.g. John Smith - paid"
              value={label}
              onChange={e => setLabel(e.target.value)}
              data-testid="input-invite-label"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-count">How many</Label>
            <Input
              id="invite-count"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
              data-testid="input-invite-count"
            />
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={generating || !!error} variant="accent" data-testid="button-generate-codes">
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Generate {count > 1 ? `${count} codes` : 'code'}
        </Button>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        !setupRequired && <Button variant="outline" onClick={() => void refetch()}>Retry loading codes</Button>
      ) : (
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold mb-3">
              Available <Badge variant="secondary">{unused.length}</Badge>
            </h2>
            {unused.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unused codes. Generate some above.</p>
            ) : (
              <div className="space-y-2">
                {unused.map(c => (
                  <div key={c.id} className="flex min-w-0 flex-wrap items-center justify-between p-3 rounded-lg border bg-card gap-3" data-testid={`row-code-${c.id}`}>
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold tracking-widest text-primary">{c.code}</span>
                      {c.label && <span className="ml-3 text-sm text-muted-foreground">{c.label}</span>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => copyCode(c.code)} title="Copy code" data-testid={`button-copy-code-${c.id}`}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} title="Delete code" data-testid={`button-delete-code-${c.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {used.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 text-muted-foreground">
                Used <Badge variant="outline">{used.length}</Badge>
              </h2>
              <div className="space-y-2">
                {used.map(c => (
                  <div key={c.id} className="flex min-w-0 flex-wrap items-center justify-between p-3 rounded-lg border bg-muted/40 gap-3 opacity-70" data-testid={`row-code-used-${c.id}`}>
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold tracking-widest line-through text-muted-foreground">{c.code}</span>
                      {c.label && <span className="ml-3 text-sm text-muted-foreground">{c.label}</span>}
                      {c.used_by_email && (
                        <span className="ml-3 text-xs text-muted-foreground">Used by {c.used_by_email}</span>
                      )}
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">Used</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Activity tab ───────────────────────────────────────────────────────────────
function ActivityTab() {
  const { data: events = [], isLoading, isError, refetch } = useQuery<ActivityEvent[]>({
    queryKey: ['/api/admin/activity'],
    queryFn: () => adminFetch('/api/admin/activity'),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  if (isError) return <LoadErrorState title="Admin activity could not be loaded" onRetry={refetch} />;

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No activity yet.</p>;
  }

  return (
    <div className="space-y-2">
      {events.map(event => (
        <div key={event.id} className="flex min-w-0 items-center gap-3 p-3 rounded-lg border bg-card" data-testid={`row-activity-${event.id}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${event.type === 'signup' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
            {event.type === 'signup'
              ? <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              : <FolderOpen className="w-4 h-4 text-green-600 dark:text-green-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{event.title}</p>
            <p className="text-xs text-muted-foreground truncate">{event.subtitle}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-muted-foreground">{format(new Date(event.createdAt), 'dd MMM yyyy')}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(event.createdAt), 'h:mm a')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main dashboard ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab') ?? 'overview';
  const tab: TabKey = VALID_TABS.includes(rawTab as TabKey) ? (rawTab as TabKey) : 'overview';

  const setTab = (value: string) => {
    setSearchParams(value === 'overview' ? {} : { tab: value }, { replace: true });
  };

  const isAdmin = user?.email === ADMIN_EMAIL;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
      <PageLayout title="Admin" description="Platform overview and management" className="space-y-6">

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <div className="w-full min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch] touch-pan-x overscroll-x-contain">
            <TabsList className="grid w-max min-w-full grid-cols-4 sm:w-full">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
              <TabsTrigger value="invites" data-testid="tab-invites">Invite Codes</TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>
          <TabsContent value="invites" className="mt-6">
            <InviteCodesTab />
          </TabsContent>
          <TabsContent value="activity" className="mt-6">
            <ActivityTab />
          </TabsContent>
        </Tabs>
      </PageLayout>
  );
}
