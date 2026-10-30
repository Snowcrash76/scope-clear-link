import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { PageLayout } from '@/components/PageLayout';
import { useProjects } from '@/hooks/useProjects';
import { useQueryClient } from '@tanstack/react-query';
import { useQuoteSummaries } from '@/hooks/useQuoteSummaries';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Users, Pencil, Trash2, Search, UserPlus, ChevronRight, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { aud } from '@/hooks/useJobCosts';
import type { QuoteSummary } from '@/lib/quoteDisplay';
import { StatusBadge } from '@/components/StatusBadge';
import { jobDisplayStatus } from '@/lib/quoteDisplay';

interface ClientInfo {
  key: string;
  name: string;
  email: string;
  address: string;
  phone: string;
  projectIds: string[];
  totalQuoted: number | null;
}

function ClientInitial({ name }: { name: string }) {
  const colors = [
    'bg-amber-600', 'bg-stone-600', 'bg-zinc-600',
    'bg-amber-800', 'bg-orange-600', 'bg-stone-500',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-heading font-bold text-sm', colors[idx])}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ClientsPage() {
  const { projects, loading } = useProjects();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const quoteQuery = useQuoteSummaries(projects.map(project => project.id));
  const [editClient, setEditClient] = useState<ClientInfo | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  const [deleteClient, setDeleteClient] = useState<ClientInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);
  const [showAddClientHelp, setShowAddClientHelp] = useState(false);

  const latestQuoteByProject = new Map<string, QuoteSummary>();
  for (const quote of [...(quoteQuery.data ?? [])].sort((a, b) =>
    Number(a.status === 'declined') - Number(b.status === 'declined') || b.created_at.localeCompare(a.created_at))) {
    if (!latestQuoteByProject.has(quote.project_id)) latestQuoteByProject.set(quote.project_id, quote);
  }

  const clients: ClientInfo[] = Object.values(
    projects.reduce<Record<string, ClientInfo>>((acc, p) => {
      const key = p.clientEmail.toLowerCase().trim() || p.clientName.toLowerCase().trim();
      if (!acc[key]) {
        acc[key] = {
          key,
          name: p.clientName,
          email: p.clientEmail,
          address: p.clientAddress ?? '',
          phone: '—',
          projectIds: [],
          totalQuoted: null,
        };
      }
      acc[key].projectIds.push(p.id);
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));
  const clientsWithTotals = clients.map(client => {
    const quoteValues = client.projectIds
      .map(projectId => latestQuoteByProject.get(projectId)?.subtotal)
      .filter((amount): amount is number => amount !== null && amount !== undefined);
    return {
      ...client,
      totalQuoted: quoteValues.length ? quoteValues.reduce((sum, amount) => sum + amount, 0) : null,
    };
  });
  const visibleClients = clientsWithTotals.filter(client => {
    const term = search.trim().toLocaleLowerCase();
    return !term || [client.name, client.email, client.address].some(value => value.toLocaleLowerCase().includes(term));
  });
  const isLoading = loading || quoteQuery.isLoading;

  function openEdit(client: ClientInfo) {
    setEditClient(client);
    setEditForm({ name: client.name, email: client.email, address: client.address });
  }

  async function handleSave() {
    if (!editClient) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          client_name: editForm.name.trim(),
          client_email: editForm.email.trim(),
          client_address: editForm.address.trim() || null,
        })
        .in('id', editClient.projectIds);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['/projects'] });
      toast.success('Client details updated');
      setEditClient(null);
    } catch {
      toast.error('Failed to update client details');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteClient) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .in('id', deleteClient.projectIds);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['/projects'] });
      toast.success(`${deleteClient.name} and their jobs removed`);
      setDeleteClient(null);
    } catch {
      toast.error('Failed to delete client');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Clients"
        description={`${clients.length} client${clients.length !== 1 ? 's' : ''} from existing jobs.`}
        actions={<Button className="min-h-11" onClick={() => setShowAddClientHelp(true)} data-testid="button-add-client"><UserPlus className="mr-2 h-4 w-4" />Add client</Button>}
      >
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search this client list</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              name="client-search"
              autoComplete="off"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search this client list"
              className="min-h-11 pl-9"
              aria-label="Search this client list"
              data-testid="input-client-list-search"
            />
          </label>
          <p className="text-sm text-muted-foreground">{visibleClients.length} {visibleClients.length === 1 ? 'client' : 'clients'}</p>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">Total quoted uses one current quote per job: the newest non-declined version, or the latest declined quote when no other version exists. Phone is not stored in the current client data.</p>
        {quoteQuery.isError && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><span>Quote totals could not be loaded; totals are unavailable.</span><Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => quoteQuery.refetch()}>Retry totals</Button></div>}
        <div className="min-w-0 overflow-hidden rounded-xl border border-[#D8C3AD] bg-white shadow-card">
          <div className="hidden border-b bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:grid xl:grid-cols-[minmax(120px,1.25fr)_minmax(190px,2fr)_minmax(80px,.8fr)_minmax(120px,1.3fr)_70px_minmax(120px,1.2fr)_88px] xl:gap-3">
            <span>Name</span><span>Email</span><span>Phone</span><span>Address</span><span>Jobs</span><span className="text-right">Total quoted (ex GST)</span><span />
          </div>
          {isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold">No clients yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Clients are created with jobs in the current workspace. Use New Job to add the first client.</p>
            </div>
          ) : visibleClients.length === 0 ? (
            <div className="px-4 py-12 text-center"><Users className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-semibold">No matching clients</p><p className="mt-1 text-sm text-muted-foreground">Try another name, email or address.</p></div>
          ) : (
            <div className="divide-y divide-border/50">
              {visibleClients.map(client => (
                <div
                  key={client.key}
                  className="group transition-colors hover:bg-muted/40"
                  data-testid={`client-row-${client.key}`}
                >
                  <div className="flex items-center gap-2 px-2 py-2 xl:hidden">
                    <button type="button" onClick={() => setSelectedClient(client)} className="flex min-h-20 min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <ClientInitial name={client.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold">{client.name}</span>
                        {client.email && <span className="mt-0.5 block break-all text-sm text-muted-foreground">{client.email}</span>}
                        <span className="mt-1 block text-sm text-muted-foreground">Phone {client.phone} · {client.projectIds.length} jobs</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums">{client.totalQuoted === null ? '—' : aud(client.totalQuoted)}</span>
                        <span className="block text-sm text-muted-foreground">quoted ex GST</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" onClick={() => openEdit(client)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Edit ${client.name}`} data-testid={`button-edit-client-${client.key}`}><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                      <button type="button" onClick={() => setDeleteClient(client)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Delete ${client.name}`} data-testid={`button-delete-client-${client.key}`}><Trash2 className="h-4 w-4 text-destructive" /></button>
                    </div>
                  </div>

                  <div className="hidden items-center gap-2 px-3 py-2 xl:flex">
                    <button type="button" onClick={() => setSelectedClient(client)} className="grid min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:grid-cols-[minmax(120px,1.25fr)_minmax(190px,2fr)_minmax(80px,.8fr)_minmax(120px,1.3fr)_70px_minmax(120px,1.2fr)]">
                      <span className="flex min-w-0 items-center gap-2"><ClientInitial name={client.name} /><span className="min-w-0 break-words text-sm font-semibold">{client.name}</span></span>
                      <span className="min-w-0 truncate text-sm text-foreground" title={client.email}>{client.email || '—'}</span>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" />{client.phone}</span>
                      <span className="min-w-0 truncate text-sm text-muted-foreground" title={client.address}>{client.address || '—'}</span>
                      <span className="text-sm tabular-nums">{client.projectIds.length}</span>
                      <span className="text-right text-sm font-semibold tabular-nums">{client.totalQuoted === null ? '—' : aud(client.totalQuoted)}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" onClick={() => openEdit(client)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Edit ${client.name}`} data-testid={`button-edit-client-${client.key}`}><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                      <button type="button" onClick={() => setDeleteClient(client)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Delete ${client.name}`} data-testid={`button-delete-client-${client.key}`}><Trash2 className="h-4 w-4 text-destructive" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageLayout>

      <Dialog open={showAddClientHelp} onOpenChange={setShowAddClientHelp}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Add a client through a job</DialogTitle>
            <DialogDescription>Clients are derived from job records. This workspace has no standalone client table, so adding a client here cannot be saved without creating a job.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Use New Job to create the job and its first quote with the client details. Existing client details remain editable from this list.</p>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setShowAddClientHelp(false)}>Cancel</Button>
            <Button type="button" className="min-h-11" onClick={() => { setShowAddClientHelp(false); navigate('/projects'); }}>Go to Jobs</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedClient} onOpenChange={open => !open && setSelectedClient(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedClient?.name}</DialogTitle>
            <DialogDescription>Client details and jobs from existing project records.</DialogDescription>
          </DialogHeader>
          {selectedClient && <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
              <p className="text-sm"><span className="block text-sm text-muted-foreground">Email</span>{selectedClient.email || '—'}</p>
              <p className="text-sm"><span className="block text-sm text-muted-foreground">Phone</span>{selectedClient.phone}</p>
              <p className="text-sm sm:col-span-2"><span className="block text-sm text-muted-foreground">Address</span>{selectedClient.address || '—'}</p>
              <p className="text-sm"><span className="block text-sm text-muted-foreground">Jobs</span>{selectedClient.projectIds.length}</p>
              <p className="text-sm"><span className="block text-sm text-muted-foreground">Total quoted</span>{selectedClient.totalQuoted === null ? '—' : `${aud(selectedClient.totalQuoted)} ex GST`}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Jobs</h3>
              <div className="mt-2 divide-y rounded-xl border">
                {selectedClient.projectIds.map(projectId => {
                  const project = projects.find(item => item.id === projectId);
                  if (!project) return null;
                  const quote = latestQuoteByProject.get(projectId);
                  return <Link key={projectId} to={`/manage/${projectId}`} onClick={() => setSelectedClient(null)} className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-muted/40">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{project.name}</span><span className="block text-sm text-muted-foreground">{quote?.subtotal == null ? 'No quote value' : `${aud(quote.subtotal)} ex GST`}</span></span>
                    <StatusBadge size="sm" status={jobDisplayStatus(project, quote)} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>;
                })}
              </div>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editClient} onOpenChange={open => !open && setEditClient(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Updates will apply to all projects linked to this client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                name="client-name"
                autoComplete="off"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-edit-client-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                name="client-email"
                autoComplete="off"
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                data-testid="input-edit-client-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                data-testid="input-edit-client-address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setEditClient(null)}>Cancel</Button>
            <Button className="min-h-11" onClick={handleSave} disabled={saving || !editForm.name.trim()} data-testid="button-save-client">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteClient} onOpenChange={open => !open && setDeleteClient(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete client?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteClient?.name}</strong> and all{' '}
              {deleteClient && deleteClient.projectIds.length > 1
                ? `${deleteClient.projectIds.length} projects`
                : 'their project'}{' '}
              associated with them. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setDeleteClient(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={handleDelete}
              disabled={deleting}
              data-testid="button-confirm-delete-client"
            >
              {deleting ? 'Deleting…' : 'Delete client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
