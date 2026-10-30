import { Card } from '@/components/ui/card';
import type { ChangeRequest } from '@/types/project';
import { AlertCircle, CheckCircle2, FolderOpen, X } from 'lucide-react';

type ProjectManageNotificationsProps = {
  showActionRequired: boolean;
  showVariationUpdate: boolean;
  showDocNotification: boolean;
  pendingClientRequestCount: number;
  recentlyResolvedChanges: ChangeRequest[];
  newDocumentCount: number;
  onDismissActionRequired: () => void;
  onDismissVariationUpdate: () => void;
  onDismissDocNotification: () => void;
};

export function ProjectManageNotifications({
  showActionRequired,
  showVariationUpdate,
  showDocNotification,
  pendingClientRequestCount,
  recentlyResolvedChanges,
  newDocumentCount,
  onDismissActionRequired,
  onDismissVariationUpdate,
  onDismissDocNotification,
}: ProjectManageNotificationsProps) {
  if (!showActionRequired && !showVariationUpdate && !showDocNotification) return null;

  return (
    <div className="mb-6 space-y-3">
      {showActionRequired && (
        <Card className="border-pending/30 bg-pending/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-full bg-pending/20 p-2">
              <AlertCircle className="h-5 w-5 text-pending-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading font-semibold text-pending-foreground">Action Required</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your client has submitted {pendingClientRequestCount} variation{pendingClientRequestCount > 1 ? 's' : ''} that {pendingClientRequestCount > 1 ? 'need' : 'needs'} your response — see the Variations tab.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissActionRequired}
              data-testid="button-dismiss-action-required"
              className="flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}
      {showDocNotification && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-full bg-primary/10 p-2">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading font-semibold text-primary">New Documents</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {newDocumentCount === 1
                  ? '1 document was uploaded recently — see the Documents tab.'
                  : `${newDocumentCount} documents were uploaded recently — see the Documents tab.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissDocNotification}
              data-testid="button-dismiss-doc-notification"
              className="flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}
      {showVariationUpdate && (
        <Card className="border-approved/20 bg-approved/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-full bg-approved/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-approved" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading font-semibold text-approved">Variations Update</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {(() => {
                  const approvedCount = recentlyResolvedChanges.filter(change => change.status === 'approved').length;
                  const declinedCount = recentlyResolvedChanges.filter(change => change.status === 'declined').length;
                  const parts: string[] = [];
                  if (approvedCount > 0) parts.push(`${approvedCount} variation${approvedCount > 1 ? 's' : ''} approved`);
                  if (declinedCount > 0) parts.push(`${declinedCount} variation${declinedCount > 1 ? 's' : ''} declined`);
                  return `${parts.join(' and ')} by your client recently — see the Variations tab for details.`;
                })()}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissVariationUpdate}
              data-testid="button-dismiss-variation-update"
              className="flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
