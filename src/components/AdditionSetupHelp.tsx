import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import sql from '../../supabase/migrations/20261027000001_addition_variations.sql?raw';

export function AdditionSetupHelp({ saveFailed = false }: { saveFailed?: boolean }) {
  return <div role="alert" className="rounded-lg border p-3 space-y-2">
    <p className="text-sm">{saveFailed ? 'The variation was not saved. Your form entries have been kept. ' : ''}Addition variations and quote-item links require a one-time database update. Copy the SQL, open Supabase SQL Editor, paste it and click Run. Then return here and save. Existing quote prices are unchanged.</p>
    <Button type="button" variant="outline" onClick={async () => {
      try { await navigator.clipboard.writeText(sql); toast.success('Addition setup SQL copied'); }
      catch { toast.error('Could not copy SQL. Check clipboard permissions.'); }
    }}>Copy Addition setup SQL</Button>
    <Button asChild variant="outline"><a href="https://supabase.com/dashboard/project/aswmcyldowvpugmfmykf/sql/new" target="_blank" rel="noopener noreferrer">Open Supabase SQL Editor</a></Button>
  </div>;
}
