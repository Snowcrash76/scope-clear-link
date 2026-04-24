import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useProjects } from '@/hooks/useProjects';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, Mail, MapPin } from 'lucide-react';
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
    <div className={cn('w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-heading font-bold text-lg', colors[idx])}>
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

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-36" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(client => (
              <div
                key={client.key}
                className="rounded-xl border bg-card p-5"
                data-testid={`client-card-${client.key}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <ClientInitial name={client.name} />
                  <p className="font-semibold text-sm leading-snug">{client.name}</p>
                </div>
                <div className="space-y-2">
                  {client.email ? (
                    <div className="flex items-start gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground break-all">{client.email}</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground/40 italic">No email</span>
                    </div>
                  )}
                  {client.address ? (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{client.address}</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground/40 italic">No address</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
