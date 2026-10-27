import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import setupSql from '../../supabase/migrations/20260503_invite_codes.sql?raw';

export function InviteCodeSetupHelp({ onRetry }: { onRetry: () => void }) {
  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(setupSql.trim());
      toast.success('Invite-code setup SQL copied');
    } catch {
      toast.error('Could not copy SQL. Please check clipboard permissions.');
    }
  };
  return (
    <div className="rounded-lg border border-amber-300 bg-background p-4 space-y-3">
      <h3 className="font-semibold">Set up invite codes</h3>
      <p className="text-sm text-muted-foreground">
        The invite-code database setup is missing. Copy the setup SQL, open Supabase SQL Editor,
        paste it and click Run. Then return here and click Retry. This creates the invite-code
        table with server-only access; it does not change your clients, quotes or invoices.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={copySql}>Copy invite-code setup SQL</Button>
        <Button asChild variant="outline">
          <a href="https://supabase.com/dashboard/project/aswmcyldowvpugmfmykf/sql/new" target="_blank" rel="noopener noreferrer">Open Supabase SQL Editor</a>
        </Button>
        <Button type="button" variant="outline" onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}
