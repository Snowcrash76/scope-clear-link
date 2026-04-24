import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivityFeed, type ActivityEvent, type ActivityEventType } from '@/hooks/useActivityFeed';
import {
  FolderPlus,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const EVENT_CONFIG: Record<
  ActivityEventType,
  { icon: React.ElementType; iconClass: string; bgClass: string }
> = {
  project_created: {
    icon: FolderPlus,
    iconClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
  quote_sent: {
    icon: Send,
    iconClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
  },
  quote_approved: {
    icon: CheckCircle2,
    iconClass: 'text-approved',
    bgClass: 'bg-approved/10',
  },
  quote_declined: {
    icon: XCircle,
    iconClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  invoice_sent: {
    icon: FileText,
    iconClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
  },
  invoice_paid: {
    icon: DollarSign,
    iconClass: 'text-approved',
    bgClass: 'bg-approved/10',
  },
  variation_raised: {
    icon: AlertCircle,
    iconClass: 'text-warning',
    bgClass: 'bg-warning/10',
  },
  variation_approved: {
    icon: CheckCircle2,
    iconClass: 'text-approved',
    bgClass: 'bg-approved/10',
  },
  variation_declined: {
    icon: XCircle,
    iconClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
};

function EventRow({ event }: { event: ActivityEvent }) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <Link
      to={`/manage/${event.projectId}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg group"
      data-testid={`activity-event-${event.id}`}
    >
      <div className={cn('p-1.5 rounded-lg mt-0.5 flex-shrink-0', config.bgClass)}>
        <Icon className={cn('w-3.5 h-3.5', config.iconClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug group-hover:text-primary transition-colors">
          {event.description}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDistanceToNow(event.timestamp, { addSuffix: true })}
        </p>
      </div>
    </Link>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="text-center py-10 px-4">
      <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm font-medium">No recent activity</p>
      <p className="text-xs text-muted-foreground mt-1">
        Events will appear here as you create jobs, send quotes, and more.
      </p>
    </div>
  );
}

export function ActivityFeed() {
  const { data: events, isLoading } = useActivityFeed();

  return (
    <div data-testid="activity-feed">
      <h2 className="font-heading text-base font-semibold mb-2 px-1">Recent Activity</h2>
      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <FeedSkeleton />
        ) : !events?.length ? (
          <EmptyFeed />
        ) : (
          <div className="divide-y divide-border/50">
            {events.map(event => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
