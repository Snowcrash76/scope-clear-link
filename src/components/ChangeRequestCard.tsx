import { ChangeRequest } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
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
  isClientView?: boolean;
}

const typeConfig = {
  client_request: {
    icon: MessageSquarePlus,
    label: 'Your Request',
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
  isClientView = true 
}: ChangeRequestCardProps) {
  const config = typeConfig[request.type];
  const Icon = config.icon;

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
          <StatusBadge status={request.status} />
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {request.description}
        </p>

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
        <p className="text-xs text-muted-foreground mb-4">
          Submitted {format(request.createdAt, 'MMM d, yyyy')}
          {request.resolvedAt && ` • Resolved ${format(request.resolvedAt, 'MMM d, yyyy')}`}
        </p>

        {/* Actions */}
        {isClientView && request.status === 'pending' && (
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
