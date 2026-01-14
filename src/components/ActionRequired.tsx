import { ChangeRequest, ScopeItem } from '@/types/project';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionRequiredProps {
  pendingChanges: ChangeRequest[];
  unacknowledgedItems: ScopeItem[];
  viewerRole: 'client' | 'trade';
}

export function ActionRequired({ pendingChanges, unacknowledgedItems, viewerRole }: ActionRequiredProps) {
  // Filter changes to only show ones that this viewer can approve
  const changesAwaitingApproval = pendingChanges.filter(change => 
    viewerRole === 'client' 
      ? change.type !== 'client_request'  // Client approves trade variations (site_issue, substitution)
      : change.type === 'client_request'   // Trade approves client requests
  );
  
  const hasActions = changesAwaitingApproval.length > 0 || unacknowledgedItems.length > 0;

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
            {changesAwaitingApproval.length > 0 && (
              <li>
                • {changesAwaitingApproval.length} change{changesAwaitingApproval.length > 1 ? 's' : ''} awaiting your approval
              </li>
            )}
            {unacknowledgedItems.length > 0 && (
              <li>
                • {unacknowledgedItems.length} scope item{unacknowledgedItems.length > 1 ? 's' : ''} to acknowledge
              </li>
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}
