import { LoadErrorState } from '@/components/LoadErrorState';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

export type ProjectActivityEvent = {
  id: string;
  timestamp: Date;
  label: string;
  detail: string;
  kind: string;
};

type ProjectActivityContentProps = {
  activityEvents: ProjectActivityEvent[];
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
};

export function ProjectActivityContent({
  activityEvents,
  isLoading,
  hasError,
  onRetry,
}: ProjectActivityContentProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-heading text-lg font-semibold">Job activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">A record of saved quote, line-item and variation events.</p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{activityEvents.length} {activityEvents.length === 1 ? 'event' : 'events'}</span>
      </div>
      {isLoading ? (
        <div className="space-y-3 p-5" aria-label="Loading job activity">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : hasError ? (
        <div className="p-4 sm:p-5">
          <LoadErrorState title="Job activity could not be loaded" description="A failed activity request is not evidence that no saved activity exists." onRetry={onRetry} />
        </div>
      ) : activityEvents.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No activity recorded yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Saved job events will appear here.</p>
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {activityEvents.map(event => (
            <li key={event.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-900">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{event.label}</p>
                <p className="mt-0.5 break-words text-sm text-muted-foreground">{event.detail}</p>
              </div>
              <time className="shrink-0 pt-0.5 text-right text-sm text-muted-foreground" dateTime={event.timestamp.toISOString()}>
                {format(event.timestamp, 'd MMM yyyy · h:mm a')}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
