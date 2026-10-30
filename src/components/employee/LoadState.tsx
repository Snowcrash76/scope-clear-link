import { Button } from "@/components/ui/button";

import { card, outline } from "./portalShared";

export function LoadState({
  error,
  retry,
}: {
  error?: Error | null;
  retry: () => void;
}) {
  if (error)
    return (
      <div className={`${card} p-6`} role="alert">
        <p className="font-semibold">Could not load this view</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        {/migration|relation|schema|setup/i.test(error.message) && (
          <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
            Portal setup is required. Apply{" "}
            <code>supabase/migrations/20261029000000_employee_portal.sql</code>{" "}
            and retry.
          </p>
        )}
        <Button className={`${outline} mt-4`} onClick={retry}>
          Retry
        </Button>
      </div>
    );
  return (
    <div className="space-y-3" aria-label="Loading">
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
