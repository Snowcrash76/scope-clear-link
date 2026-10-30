import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadErrorState({
  title = 'We couldn’t load this information',
  description = 'Your saved data may still be available. Try again in a moment.',
  onRetry,
  className = '',
}: {
  title?: string;
  description?: string;
  onRetry: () => unknown;
  className?: string;
}) {
  return (
    <section role="alert" className={`rounded-xl border border-amber-300 bg-amber-50 p-5 text-zinc-950 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-950" aria-hidden="true">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-800">{description}</p>
        </div>
        <Button type="button" variant="outline" className="min-h-11 shrink-0 gap-2 border-amber-800 bg-white text-zinc-950 hover:bg-amber-100" onClick={() => void onRetry()}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    </section>
  );
}
