import { ChangeRequest } from '@/types/project';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ActionRequiredProps {
  pendingChanges: ChangeRequest[];
  viewerRole: 'client' | 'trade';
  quoteAwaitingApproval?: boolean;
  newInvoiceCount?: number;
}

export function ActionRequired({ pendingChanges, viewerRole, quoteAwaitingApproval, newInvoiceCount = 0 }: ActionRequiredProps) {
  const changesAwaitingApproval = pendingChanges.filter(change => {
    if (viewerRole === 'client') {
      // Client needs to act on:
      // 1. Trade-initiated variations (site_issue, substitution) that are pending
      // 2. Client's own requests that the trade has responded to with costs (awaiting_client = client needs to decide)
      return change.type !== 'client_request' || change.status === 'awaiting_client';
    }
    // Trade needs to act on pending client requests
    return change.type === 'client_request' && change.status === 'pending';
  });
  
  const hasActions = changesAwaitingApproval.length > 0 || quoteAwaitingApproval || newInvoiceCount > 0;

  if (!hasActions) {
    return (
      <Card className="p-4 bg-approved/5 border-approved/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-approved/10">
            <CheckCircle2 className="w-5 h-5 text-approved" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-approved">You're all caught up!</h3>
            <p className="text-sm text-muted-foreground">No actions needed from you right now.</p>
          </div>
        </div>
      </Card>
    );
  }

  const tradeVariations = changesAwaitingApproval.filter(c => c.type !== 'client_request');
  const clientRequestsWithResponse = changesAwaitingApproval.filter(c => c.type === 'client_request' && c.status === 'awaiting_client');
  const tradeClientRequests = changesAwaitingApproval.filter(c => c.type === 'client_request' && c.status === 'pending');

  return (
    <Card className="p-4 bg-pending/5 border-pending/30 animate-pulse-soft">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-pending/20">
          <AlertCircle className="w-5 h-5 text-pending-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-semibold text-pending-foreground">Action Required</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {newInvoiceCount > 0 && (
              <li>• You have {newInvoiceCount} new invoice{newInvoiceCount > 1 ? 's' : ''} — review {newInvoiceCount > 1 ? 'them' : 'it'} in the Invoices tab</li>
            )}
            {quoteAwaitingApproval && (
              <li>• Your quote is ready — please review and approve or decline it in the Quote tab</li>
            )}
            {tradeVariations.length > 0 && (
              <li>
                • {tradeVariations.length} variation{tradeVariations.length > 1 ? 's' : ''} from your trade {tradeVariations.length > 1 ? 'are' : 'is'} awaiting your approval in the Variations tab
              </li>
            )}
            {clientRequestsWithResponse.length > 0 && (
              <li>
                • Your trade has responded to {clientRequestsWithResponse.length} of your change {clientRequestsWithResponse.length > 1 ? 'requests' : 'request'} — review the updated costs in the Variations tab
              </li>
            )}
            {tradeClientRequests.length > 0 && (
              <li>
                • {tradeClientRequests.length} client change {tradeClientRequests.length > 1 ? 'requests' : 'request'} awaiting your response
              </li>
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}
