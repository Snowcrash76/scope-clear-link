import { ChangeRequest } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { ImageDisplay } from '@/components/ImageUpload';
import { 
  MessageSquarePlus, 
  AlertTriangle, 
  RefreshCw, 
  DollarSign, 
  Clock,
  Check,
  X,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChangeRequestCardProps {
  request: ChangeRequest;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRespond?: (id: string) => void;
  viewerRole: 'client' | 'trade';
  // Parent-controlled optimistic state — immune to local re-renders
  isApprovedOptimistically?: boolean;
  isDeclinedOptimistically?: boolean;
  // Comment the client entered in the decline modal, surfaced immediately
  // without waiting for the server refetch.
  optimisticComment?: string;
}

const typeConfig = {
  client_request: {
    icon: MessageSquarePlus,
    label: 'Client Request',
    color: 'text-primary',
    bgColor: 'bg-primary/5',
  },
  site_issue: {
    icon: AlertTriangle,
    label: 'Site Issue',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  substitution: {
    icon: RefreshCw,
    label: 'Substitution',
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
  },
};

export function ChangeRequestCard({ 
  request, 
  onApprove, 
  onDecline,
  onRespond,
  viewerRole,
  isApprovedOptimistically = false,
  isDeclinedOptimistically = false,
  optimisticComment,
}: ChangeRequestCardProps) {
  const config = typeConfig[request.type];
  const Icon = config.icon;

  const optimisticDecision = isApprovedOptimistically
    ? 'approved'
    : isDeclinedOptimistically
    ? 'declined'
    : null;

  // Show "New" badge for variations resolved in the last 72 hours
  const isRecentlyResolved =
    !optimisticDecision &&
    request.resolvedAt != null &&
    (request.status === 'approved' || request.status === 'declined') &&
    (Date.now() - request.resolvedAt.getTime()) < 72 * 60 * 60 * 1000;

  // Trade can respond to pending client requests (adds costs and sends back)
  const canTradeRespond = viewerRole === 'trade' && 
    request.type === 'client_request' && 
    request.status === 'pending';

  // Client can approve/decline awaiting_client requests (trade has responded with costs)
  const canClientApproveClientRequest = viewerRole === 'client' && 
    request.type === 'client_request' && 
    request.status === 'awaiting_client';

  // Client can also approve/decline trade-initiated requests (site_issue, substitution) when pending
  const canClientApproveTradeRequest = viewerRole === 'client' && 
    request.type !== 'client_request' && 
    request.status === 'pending';

  // Hide approve/decline buttons once the client has made a decision
  const canApprove = (canClientApproveClientRequest || canClientApproveTradeRequest) && !optimisticDecision;

  // Check if this is awaiting the other party's response
  const isAwaitingOtherParty = !optimisticDecision && (
    (viewerRole === 'client' && request.type === 'client_request' && request.status === 'pending') ||
    (viewerRole === 'trade' && request.type !== 'client_request' && request.status === 'pending') ||
    (viewerRole === 'trade' && request.status === 'awaiting_client')
  );

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      request.status === 'pending' && !optimisticDecision && "ring-2 ring-pending/50",
      isApprovedOptimistically && "ring-2 ring-approved/40"
    )}>
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <Icon className={cn("w-4 h-4", config.color)} />
            </div>
            <div>
              <Badge variant="secondary" className="text-xs mb-1">
                {config.label}
              </Badge>
              <h3 className="font-heading font-semibold">{request.title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRecentlyResolved && (
              <Badge variant="success" className="gap-1 text-xs">
                <CheckCircle2 className="w-3 h-3" />
                New
              </Badge>
            )}
            {!optimisticDecision && (
              <StatusBadge status={request.status} viewerRole={viewerRole} />
            )}
            {isApprovedOptimistically && (
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved
              </Badge>
            )}
            {isDeclinedOptimistically && (
              <Badge variant="destructive" className="gap-1.5">
                <X className="w-3.5 h-3.5" />
                Declined
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {request.description}
        </p>

        {/* Image */}
        {request.imageUrl && (
          <div className="mb-4">
            <ImageDisplay src={request.imageUrl} alt={request.title} className="max-w-sm" />
          </div>
        )}

        {request.reason && (
          <p className="text-xs text-muted-foreground italic mb-4">
            Reason: {request.reason}
          </p>
        )}

        {/* Impact */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
            request.costImpact > 0 ? "bg-warning/10 text-warning-foreground" : 
            request.costImpact < 0 ? "bg-approved/10 text-approved" : 
            "bg-secondary text-muted-foreground"
          )}>
            <DollarSign className="w-4 h-4" />
            <span className="font-medium">
              {request.costImpact === 0 ? 'No cost change' : 
               request.costImpact > 0 ? `+$${request.costImpact.toLocaleString()}` : 
               `-$${Math.abs(request.costImpact).toLocaleString()}`}
            </span>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
            request.timeImpact > 0 ? "bg-warning/10 text-warning-foreground" : 
            "bg-secondary text-muted-foreground"
          )}>
            <Clock className="w-4 h-4" />
            <span className="font-medium">
              {request.timeImpact === 0 ? 'No delay' : 
               `+${request.timeImpact} day${request.timeImpact > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* Date */}
        <p className="text-xs text-muted-foreground mb-2">
          Submitted {format(request.createdAt, 'MMM d, yyyy')}
          {request.resolvedAt && ` • Resolved ${format(request.resolvedAt, 'MMM d, yyyy')}`}
        </p>

        {/* Client's comment on this variation */}
        {request.resolutionComment && request.status !== 'pending' && request.status !== 'awaiting_client' && !optimisticDecision && (
          <div className="mb-4 p-3 rounded-lg bg-secondary/60 border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Client's comment
            </p>
            <p className="text-sm">{request.resolutionComment}</p>
          </div>
        )}

        {/* Optimistic confirmation after client approves */}
        {isApprovedOptimistically && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-approved/10 text-approved">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">
                Variation approved — your trade has been notified.
              </p>
            </div>
          </div>
        )}

        {/* Optimistic confirmation after client declines */}
        {isDeclinedOptimistically && (
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <X className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">
                Variation declined — your trade has been notified.
              </p>
            </div>
            {optimisticComment && (
              <div className="px-3 py-2 rounded-lg bg-secondary/60">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Your comment</p>
                <p className="text-sm">{optimisticComment}</p>
              </div>
            )}
          </div>
        )}

        {/* Awaiting other party notice */}
        {isAwaitingOtherParty && (
          <div className="pt-3 border-t">
            <p className="text-sm text-muted-foreground text-center">
              {viewerRole === 'client' && request.type === 'client_request' && request.status === 'pending'
                ? 'Your trade is reviewing this request'
                : viewerRole === 'trade' && request.status === 'awaiting_client'
                ? 'Waiting for client approval'
                : 'Awaiting client response'}
            </p>
          </div>
        )}

        {/* Trade can respond to client requests */}
        {canTradeRespond && (
          <div className="flex gap-3 pt-3 border-t">
            <Button 
              variant="default" 
              className="flex-1"
              onClick={() => onRespond?.(request.id)}
            >
              Respond to Client
            </Button>
          </div>
        )}

        {/* Client approve/decline — hidden once a decision is made */}
        {canApprove && (
          <div className="flex gap-3 pt-3 border-t">
            <Button 
              variant="approve" 
              className="flex-1"
              onClick={() => onApprove?.(request.id)}
              data-testid={`button-approve-variation-${request.id}`}
            >
              <Check className="w-4 h-4" />
              Approve
            </Button>
            <Button 
              variant="decline"
              onClick={() => onDecline?.(request.id)}
              data-testid={`button-decline-variation-${request.id}`}
            >
              <X className="w-4 h-4" />
              Decline
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
