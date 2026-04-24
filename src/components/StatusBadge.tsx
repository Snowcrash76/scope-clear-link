import { Check, Clock, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'awaiting_client' | 'approved' | 'declined' | 'acknowledged';
  size?: 'sm' | 'default';
  viewerRole?: 'client' | 'trade';
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-amber-50 text-amber-800 border-amber-100',
  },
  awaiting_client: {
    icon: Send,
    label: null,
    className: 'bg-amber-50 text-amber-800 border-amber-100',
  },
  approved: {
    icon: Check,
    label: 'Approved',
    className: 'bg-green-50 text-green-800 border-green-100',
  },
  declined: {
    icon: X,
    label: 'Declined',
    className: 'bg-red-50 text-red-700 border-red-100',
  },
  acknowledged: {
    icon: Check,
    label: 'Acknowledged',
    className: 'bg-green-50 text-green-800 border-green-100',
  },
} as const;

export function StatusBadge({ status, size = 'default', viewerRole }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const label = status === 'awaiting_client'
    ? (viewerRole === 'client' ? 'Awaiting Your Approval' : 'Sent to Client')
    : config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-colors',
        config.className,
        size === 'sm' ? 'text-[10px] px-2 py-0' : 'text-xs px-2.5 py-0.5'
      )}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3 mr-1' : 'w-3.5 h-3.5 mr-1.5'} />
      {label}
    </span>
  );
}
