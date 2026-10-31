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
  RefreshCw,
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
    iconClass: 'text-info',
    bgClass: 'bg-info/10',
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
    iconClass: 'text-info',
    bgClass: 'bg-info/10',
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
      className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent/30"
      data-testid={`activity-event-${event.id}`}
    >
      <div className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', config.bgClass)}>
        <Icon className={cn('w-3.5 h-3.5', config.iconClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {event.description}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground" title={event.timestamp.toLocaleString('en-AU')}>
          {formatDistanceToNow(event.timestamp, { addSuffix: true })}
        </p>
      </div>
    </Link>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 3 }).map((_, i) => (
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

function ErrorFeed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-10 px-4">
      <RefreshCw className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm font-medium">Couldn't load activity</p>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        There was a problem fetching recent events.
      </p>
      <button
        onClick={onRetry}
        className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
        data-testid="button-activity-retry"
      >
        Try again
      </button>
    </div>
  );
}

export function ActivityFeed() {
  const { data: events, isLoading, isError, refetch } = useActivityFeed();
  const hasMore = (events?.length ?? 0) > 3;

  return (
    <div data-testid="activity-feed">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-heading text-xl font-semibold leading-7">Recent Activity</h2>
        {!isLoading && !isError && hasMore && (
          <span className="text-xs text-muted-foreground">{events!.length} events — scroll to see all</span>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <FeedSkeleton />
        ) : isError ? (
          <ErrorFeed onRetry={refetch} />
        ) : !events?.length ? (
          <EmptyFeed />
        ) : (
          <div
            className="divide-y divide-border/50 overflow-y-auto"
            style={{ maxHeight: '195px' }}
            data-testid="activity-feed-scroll"
          >
            {events.map(event => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
