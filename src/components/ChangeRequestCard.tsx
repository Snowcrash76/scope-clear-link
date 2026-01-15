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
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChangeRequestCardProps {
  request: ChangeRequest;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRespond?: (id: string) => void;
  viewerRole: 'client' | 'trade';
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
  viewerRole
}: ChangeRequestCardProps) {
  const config = typeConfig[request.type];
  const Icon = config.icon;

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

  // Combined: can approve if either condition is met
  const canApprove = canClientApproveClientRequest || canClientApproveTradeRequest;

  // Check if this is awaiting the other party's response
  const isAwaitingOtherParty = (
    (viewerRole === 'client' && request.type === 'client_request' && request.status === 'pending') ||
    (viewerRole === 'trade' && request.type !== 'client_request' && request.status === 'pending') ||
    (viewerRole === 'trade' && request.status === 'awaiting_client')
  );

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      request.status === 'pending' && "ring-2 ring-pending/50"
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
          <StatusBadge status={request.status} viewerRole={viewerRole} />
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

        {/* Date and Resolution Comment */}
        <p className="text-xs text-muted-foreground mb-2">
          Submitted {format(request.createdAt, 'MMM d, yyyy')}
          {request.resolvedAt && ` • Resolved ${format(request.resolvedAt, 'MMM d, yyyy')}`}
        </p>

        {/* Resolution Comment */}
        {request.resolutionComment && request.status !== 'pending' && (
          <div className="mb-4 p-3 rounded-lg bg-secondary/50">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">
                {request.status === 'approved' ? 'Approval' : 'Decline'} comment:
              </span>{' '}
              {request.resolutionComment}
            </p>
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

        {/* Client can approve/decline */}
        {canApprove && (
          <div className="flex gap-3 pt-3 border-t">
            <Button 
              variant="approve" 
              className="flex-1"
              onClick={() => onApprove?.(request.id)}
            >
              <Check className="w-4 h-4" />
              Approve
            </Button>
            <Button 
              variant="decline"
              onClick={() => onDecline?.(request.id)}
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
