import { Check, Clock, X, Send, CircleDot, Briefcase, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'default';
  viewerRole?: 'client' | 'trade';
  className?: string;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  awaiting_client: {
    icon: Send,
    label: null,
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  approved: {
    icon: Check,
    label: 'Approved',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  declined: {
    icon: X,
    label: 'Declined',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  acknowledged: {
    icon: Check,
    label: 'Acknowledged',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  draft: { icon: CircleDot, label: 'Draft', className: 'bg-stone-100 text-stone-800 border-stone-300' },
  sent: { icon: Send, label: 'Sent', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  expired: { icon: Clock, label: 'Expired', className: 'bg-stone-100 text-stone-800 border-stone-300' },
  lead: { icon: CircleDot, label: 'Lead', className: 'bg-stone-100 text-stone-800 border-stone-300' },
  quoted: { icon: Send, label: 'Quoted', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  in_progress: { icon: Briefcase, label: 'In progress', className: 'bg-sky-100 text-sky-900 border-sky-300' },
  completed: { icon: CircleCheck, label: 'Completed', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
} as const;

export function StatusBadge({ status, size = 'default', viewerRole, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    icon: CircleDot, label: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    className: 'bg-muted text-foreground border-border',
  };
  const Icon = config.icon;
  const label = status === 'awaiting_client'
    ? (viewerRole === 'client' ? 'Awaiting Your Approval' : 'Sent to Client')
    : config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-colors',
        config.className,
        className,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
      )}
      aria-label={`Status: ${label}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3 mr-1' : 'w-3.5 h-3.5 mr-1.5'} />
      {label}
    </span>
  );
}
