import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageLayout } from '@/components/PageLayout';
import { useProjects } from '@/hooks/useProjects';
import { useQueryClient } from '@tanstack/react-query';
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
import { Users, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ClientInfo {
  key: string;
  name: string;
  email: string;
  address: string;
  projectIds: string[];
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
  const qc = useQueryClient();
  const [editClient, setEditClient] = useState<ClientInfo | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  const [deleteClient, setDeleteClient] = useState<ClientInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const clients: ClientInfo[] = Object.values(
    projects.reduce<Record<string, ClientInfo>>((acc, p) => {
      const key = p.clientEmail.toLowerCase().trim() || p.clientName.toLowerCase().trim();
      if (!acc[key]) {
        acc[key] = {
          key,
          name: p.clientName,
          email: p.clientEmail,
          address: p.clientAddress ?? '',
          projectIds: [],
        };
      }
      acc[key].projectIds.push(p.id);
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

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
      <PageLayout title="Clients" description={
          loading ? 'Loading…' : `${clients.length} client${clients.length !== 1 ? 's' : ''}`
        }>
        <div className="min-w-0 rounded-xl border border-[#D8C3AD] bg-white dark:bg-zinc-900 overflow-hidden shadow-card">
          {/* Table header — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)_72px] gap-3 lg:gap-4 px-4 py-2.5 border-b bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</span>
            <span />
          </div>

          {loading ? (
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
              <p className="text-sm text-muted-foreground">
                No clients yet. Create a job to add your first client.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {clients.map(client => (
                <div
                  key={client.key}
                  className="hover:bg-muted/40 transition-colors group"
                  data-testid={`client-row-${client.key}`}
                >
                  {/* Mobile layout */}
                  <div className="flex items-center gap-3 px-4 py-3.5 sm:hidden">
                    <ClientInitial name={client.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-words">{client.name}</p>
                      {client.email && <p className="text-xs text-muted-foreground break-words">{client.email}</p>}
                      {client.address && <p className="text-xs text-muted-foreground break-words">{client.address}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(client)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-muted transition-colors"
                        aria-label={`Edit ${client.name}`}
                        title="Edit client"
                        data-testid={`button-edit-client-${client.key}`}
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeleteClient(client)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                        aria-label={`Delete ${client.name}`}
                        title="Delete client"
                        data-testid={`button-delete-client-${client.key}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)_72px] gap-3 lg:gap-4 px-4 py-3.5 items-center">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ClientInitial name={client.name} />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere] text-sm font-medium">{client.name}</span>
                    </div>
                    <span className="min-w-0 break-words [overflow-wrap:anywhere] text-sm text-muted-foreground">
                      {client.email || <span className="italic text-muted-foreground/40">—</span>}
                    </span>
                    <span className="min-w-0 break-words [overflow-wrap:anywhere] text-sm text-muted-foreground">
                      {client.address || <span className="italic text-muted-foreground/40">—</span>}
                    </span>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(client)}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        title="Edit client"
                        data-testid={`button-edit-client-${client.key}`}
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeleteClient(client)}
                        className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                        title="Delete client"
                        data-testid={`button-delete-client-${client.key}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageLayout>

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
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-edit-client-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
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
