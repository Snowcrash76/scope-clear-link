import { Badge } from '@/components/ui/badge';
import { Check, Clock, X, AlertCircle, Send } from 'lucide-react';

interface StatusBadgeProps {
  status: 'pending' | 'awaiting_client' | 'approved' | 'declined' | 'acknowledged';
  size?: 'sm' | 'default';
  viewerRole?: 'client' | 'trade';
}

export function StatusBadge({ status, size = 'default', viewerRole }: StatusBadgeProps) {
  const config = {
    pending: {
      variant: 'pending' as const,
      icon: Clock,
      label: 'Pending',
    },
    awaiting_client: {
      variant: 'default' as const,
      icon: Send,
      label: viewerRole === 'client' ? 'Awaiting Your Approval' : 'Sent to Client',
    },
    approved: {
      variant: 'success' as const,
      icon: Check,
      label: 'Approved',
    },
    declined: {
      variant: 'destructive' as const,
      icon: X,
      label: 'Declined',
    },
    acknowledged: {
      variant: 'success' as const,
      icon: Check,
      label: 'Acknowledged',
    },
  };

  const { variant, icon: Icon, label } = config[status];

  return (
    <Badge variant={variant} className={size === 'sm' ? 'text-[10px] px-2 py-0' : ''}>
      <Icon className={size === 'sm' ? 'w-3 h-3 mr-1' : 'w-3.5 h-3.5 mr-1.5'} />
      {label}
    </Badge>
  );
}
