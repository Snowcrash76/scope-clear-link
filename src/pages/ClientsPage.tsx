import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { useProjects } from '@/hooks/useProjects';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, Mail, MapPin, FolderOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientSummary {
  key: string;
  name: string;
  email: string;
  address?: string;
  projectIds: string[];
  projectNames: string[];
  activeCount: number;
  completedCount: number;
}

function ClientInitial({ name }: { name: string }) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={cn('w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white font-heading font-bold text-base', colors[idx])}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const { projects, loading } = useProjects();
  const [search, setSearch] = useState('');

  const clients: ClientSummary[] = Object.values(
    projects.reduce<Record<string, ClientSummary>>((acc, p) => {
      const key = p.clientEmail.toLowerCase().trim() || p.clientName.toLowerCase().trim();
      if (!acc[key]) {
        acc[key] = {
          key,
          name: p.clientName,
          email: p.clientEmail,
          address: p.clientAddress,
          projectIds: [],
          projectNames: [],
          activeCount: 0,
          completedCount: 0,
        };
      }
      acc[key].projectIds.push(p.id);
      acc[key].projectNames.push(p.name);
      if (p.status === 'completed') {
        acc[key].completedCount++;
      } else if (p.status !== 'draft') {
        acc[key].activeCount++;
      }
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.address ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients by name, email or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
              data-testid="input-clients-search"
            />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Clients</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : `${clients.length} client${clients.length !== 1 ? 's' : ''} across all projects`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-card overflow-hidden divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="w-11 h-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-card text-center py-14 px-4">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? `No clients matching "${search}"` : 'No clients yet. Create a job to add your first client.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden divide-y divide-border/50">
            {filtered.map(client => (
              <div
                key={client.key}
                className="flex items-center gap-4 px-4 py-4 hover:bg-muted/40 transition-colors cursor-pointer group"
                onClick={() => {
                  if (client.projectIds.length === 1) {
                    navigate(`/manage/${client.projectIds[0]}`);
                  } else {
                    navigate(`/projects?client=${encodeURIComponent(client.email || client.name)}`);
                  }
                }}
                data-testid={`client-row-${client.key}`}
              >
                <ClientInitial name={client.name} />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{client.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {client.email && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {client.email}
                      </span>
                    )}
                    {client.address && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[200px]">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {client.address}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {client.projectIds.length} {client.projectIds.length === 1 ? 'project' : 'projects'}
                    </span>
                  </div>
                  {client.activeCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                      {client.activeCount} active
                    </span>
                  )}
                  {client.completedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                      {client.completedCount} done
                    </span>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
