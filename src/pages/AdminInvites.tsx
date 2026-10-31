import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Plus, Loader2, Trash2, ArrowLeft } from 'lucide-react';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

interface InviteCode {
  id: string;
  code: string;
  label: string | null;
  used_by_email: string | null;
  used_at: string | null;
  created_at: string;
}

export default function AdminInvites() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [label, setLabel] = useState('');
  const [count, setCount] = useState(1);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [authLoading, isAdmin, navigate]);

  const fetchCodes = async () => {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setCodes((data || []) as InviteCode[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchCodes();
  }, [isAdmin]);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const rows = Array.from({ length: count }, () => ({
        code: generateCode(),
        label: label.trim() || null,
      }));
      const { error } = await supabase.from('invite_codes').insert(rows);
      if (error) throw error;
      toast.success(`${count} invite code${count > 1 ? 's' : ''} created`);
      setLabel('');
      setCount(1);
      await fetchCodes();
    } catch (err) {
      toast.error('Failed to create codes');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('invite_codes').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete code');
    } else {
      setCodes(prev => prev.filter(c => c.id !== id));
      toast.success('Code deleted');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied');
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const unused = codes.filter(c => !c.used_at);
  const used = codes.filter(c => c.used_at);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">Invite Codes</h1>
            <p className="text-sm text-muted-foreground">Generate and manage access codes for new signups</p>
          </div>
        </div>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Generate New Codes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                placeholder="Add an internal note"
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="count">How many</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={e => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
              />
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={generating} variant="accent">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Generate {count > 1 ? `${count} codes` : 'code'}
          </Button>
        </Card>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold mb-3">Available <Badge variant="secondary">{unused.length}</Badge></h2>
              {unused.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unused codes. Generate some above.</p>
              ) : (
                <div className="space-y-2">
                  {unused.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card gap-3">
                      <div className="min-w-0">
                        <span className="font-mono font-bold tracking-widest text-primary">{c.code}</span>
                        {c.label && <span className="ml-3 text-sm text-muted-foreground">{c.label}</span>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => copyCode(c.code)} title="Copy code">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} title="Delete code">
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
                <h2 className="font-semibold mb-3 text-muted-foreground">Used <Badge variant="outline">{used.length}</Badge></h2>
                <div className="space-y-2">
                  {used.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/40 gap-3 opacity-70">
                      <div className="min-w-0">
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
    </div>
  );
}
