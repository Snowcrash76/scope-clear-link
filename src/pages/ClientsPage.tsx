import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useProjects } from '@/hooks/useProjects';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientInfo {
  key: string;
  name: string;
  email: string;
  address?: string;
}

function ClientInitial({ name }: { name: string }) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
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
  const [search, setSearch] = useState('');

  const clients: ClientInfo[] = Object.values(
    projects.reduce<Record<string, ClientInfo>>((acc, p) => {
      const key = p.clientEmail.toLowerCase().trim() || p.clientName.toLowerCase().trim();
      if (!acc[key]) {
        acc[key] = {
          key,
          name: p.clientName,
          email: p.clientEmail,
          address: p.clientAddress,
        };
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
              placeholder="Search by name, email or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
              data-testid="input-clients-search"
            />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : `${clients.length} client${clients.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_2fr_3fr] gap-4 px-4 py-2.5 border-b bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</span>
          </div>

          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[2fr_2fr_3fr] gap-4 px-4 py-3.5 items-center">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? `No clients matching "${search}"` : 'No clients yet. Create a job to add your first client.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(client => (
                <div
                  key={client.key}
                  className="grid grid-cols-[2fr_2fr_3fr] gap-4 px-4 py-3.5 items-center hover:bg-muted/40 transition-colors"
                  data-testid={`client-row-${client.key}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ClientInitial name={client.name} />
                    <span className="text-sm font-medium truncate">{client.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground truncate">
                    {client.email || <span className="italic text-muted-foreground/50">—</span>}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {client.address || <span className="italic text-muted-foreground/50">—</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
