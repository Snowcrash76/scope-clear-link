import { Badge } from '@/components/ui/badge';
import { Check, Clock, X, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'declined' | 'acknowledged';
  size?: 'sm' | 'default';
}

export function StatusBadge({ status, size = 'default' }: StatusBadgeProps) {
  const config = {
    pending: {
      variant: 'pending' as const,
      icon: Clock,
      label: 'Pending Approval',
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
