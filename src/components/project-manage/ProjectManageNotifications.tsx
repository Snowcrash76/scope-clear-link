import { AlertCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ProjectManageNotificationsProps = {
  showActionRequired: boolean;
  pendingClientRequestCount: number;
  overdueInvoiceCount: number;
  onDismissActionRequired: () => void;
  activeTab: string;
  onNavigate: (tab: string) => void;
};

export function ProjectManageNotifications({
  showActionRequired,
  pendingClientRequestCount,
  overdueInvoiceCount,
  onDismissActionRequired,
  activeTab,
  onNavigate,
}: ProjectManageNotificationsProps) {
  // Overview already presents this action in its single next-action card.
  const hasVariationAction = showActionRequired && activeTab !== 'overview' && activeTab !== 'changes';
  const hasOverdueInvoice = overdueInvoiceCount > 0 && activeTab !== 'overview' && activeTab !== 'invoices';
  if (!hasVariationAction && !hasOverdueInvoice) return null;

  return (
    <aside className="mb-3 flex min-h-11 items-center gap-3 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2" role="status" aria-label="Job needs attention">
      <AlertCircle className="h-4 w-4 shrink-0 text-warning-foreground" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">
        {hasVariationAction
          ? `${pendingClientRequestCount} client variation${pendingClientRequestCount === 1 ? '' : 's'} need${pendingClientRequestCount === 1 ? 's' : ''} your response.`
          : `${overdueInvoiceCount} invoice${overdueInvoiceCount === 1 ? '' : 's'} overdue.`}
      </p>
      <Button type="button" variant="link" className="h-9 min-h-9 shrink-0 gap-1 px-1 text-sm" onClick={() => onNavigate(hasVariationAction ? 'changes' : 'invoices')}>
        {hasVariationAction ? 'Review' : 'View invoice'} <ArrowRight className="h-3.5 w-3.5" />
      </Button>
      {hasVariationAction && <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={onDismissActionRequired} aria-label="Dismiss attention notice" data-testid="button-dismiss-action-required"><X className="h-4 w-4" /></Button>}
    </aside>
  );
}
