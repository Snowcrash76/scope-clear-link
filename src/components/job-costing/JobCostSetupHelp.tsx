import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import setupSql from '../../../supabase/migrations/20261026000000_job_costing.sql?raw';
import receiptScanningSql from '../../../supabase/migrations/20261026000001_receipt_scanning.sql?raw';
import perplexityReceiptsSql from '../../../supabase/migrations/20261026000002_perplexity_receipts.sql?raw';
import quoteCostLinksSql from '../../../supabase/migrations/20261027000000_cost_quote_links.sql?raw';

export function isJobCostSetupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /relation .* does not exist|could not find the table|table .* does not exist|schema cache|42P01|PGRST205|migration (?:is )?(?:missing|required|not applied|incomplete)|database setup is incomplete|needs database setup|apply .* migration|receipt[_ -]scanning.*(?:schema|table|column|missing|setup|migration|not found)|(?:schema|table|column).*receipt[_ -]scanning/i.test(message);
}

export function JobCostSetupHelp({ scopeLinksOnly = false }: { scopeLinksOnly?: boolean } = {}) {
  const [copied, setCopied] = useState(false);
  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(scopeLinksOnly ? quoteCostLinksSql.trim() : `${setupSql.trim()}\n\n-- Receipt scanning support (safe to apply after the base setup)\n${receiptScanningSql.trim()}\n\n-- Perplexity receipt metadata support\n${perplexityReceiptsSql.trim()}\n\n-- Link costs to included quote work\n${quoteCostLinksSql.trim()}\n`);
      setCopied(true);
      toast.success('Setup SQL copied');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy SQL. Check clipboard permissions and try again.');
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-background/80 p-3">
      <p className="text-sm font-semibold text-foreground">{scopeLinksOnly ? 'Enable included-work links' : 'Activate job costing'}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {scopeLinksOnly
          ? 'Run this small costing-only update in the Supabase SQL Editor, then return and save the cost. It does not change your quotes, their items or their totals.'
          : 'Apply the costing setup, receipt-scanning updates and included-work linking update in the Supabase SQL Editor, then return here and retry. The scripts are safe to run on a fresh or existing setup.'}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="sm" variant="outline" onClick={copySql} data-testid="button-copy-job-costing-sql">
          {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
          {copied ? 'SQL copied' : scopeLinksOnly ? 'Copy linking update' : 'Copy setup SQL'}
        </Button>
        <Button asChild type="button" size="sm" variant="outline">
          <a href="https://supabase.com/dashboard/project/aswmcyldowvpugmfmykf/sql/new" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-3.5 w-3.5" />Open Supabase SQL Editor
          </a>
        </Button>
      </div>
    </div>
  );
}
