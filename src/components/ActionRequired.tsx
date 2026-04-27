import { ChangeRequest } from '@/types/project';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ActionRequiredProps {
  pendingChanges: ChangeRequest[];
  viewerRole: 'client' | 'trade';
  quoteAwaitingApproval?: boolean;
}

export function ActionRequired({ pendingChanges, viewerRole, quoteAwaitingApproval }: ActionRequiredProps) {
  const changesAwaitingApproval = pendingChanges.filter(change => 
    viewerRole === 'client' 
      ? change.type !== 'client_request'
      : change.type === 'client_request'
  );
  
  const hasActions = changesAwaitingApproval.length > 0 || quoteAwaitingApproval;

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

  return (
    <Card className="p-4 bg-pending/5 border-pending/30 animate-pulse-soft">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-pending/20">
          <AlertCircle className="w-5 h-5 text-pending-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-semibold text-pending-foreground">Action Required</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {quoteAwaitingApproval && (
              <li>• Your quote is ready — please review and approve or decline it in the Quote tab</li>
            )}
            {changesAwaitingApproval.length > 0 && (
              <li>
                • {changesAwaitingApproval.length} change{changesAwaitingApproval.length > 1 ? 's' : ''} awaiting your approval
              </li>
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}
