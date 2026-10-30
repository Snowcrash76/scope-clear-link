import { useState } from "react";
import { Button } from "@/components/ui/button";
import { portalRequest } from "@/hooks/useEmployeePortal";

const card =
  "rounded-2xl border border-border bg-card shadow-[0_3px_14px_rgba(33,54,43,.045)]";
const outline =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent/20";
const field =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground";

export function TeamLoad({
  error,
  retry,
}: {
  error?: Error | null;
  retry: () => void;
}) {
  const [setup, setSetup] = useState<{
    sql: string;
    editor_url: string;
  } | null>(null);
  const [setupError, setSetupError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadSetup() {
    setLoading(true);
    setSetupError("");
    try {
      setSetup(
        await portalRequest<{ sql: string; editor_url: string }>("/team/setup"),
      );
    } catch (problem) {
      setSetupError(
        problem instanceof Error
          ? problem.message
          : "Setup instructions could not load.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copySetup() {
    try {
      await navigator.clipboard.writeText(setup!.sql);
      setCopied(true);
    } catch {
      setSetupError(
        "Select and copy the SQL text below. Your browser did not allow clipboard access.",
      );
    }
  }

  if (!error)
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  return (
    <div role="alert" className={`${card} p-6`}>
      <b>Could not load team data</b>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      {/migration|relation|setup/i.test(error.message) && (
        <details className="mt-3 rounded-lg bg-warning/10 p-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            Database setup instructions
          </summary>
          <p>
            Publish the matching application build and apply this migration
            together during a maintenance window. Existing client project links
            will stop working and must be resent. Do not apply it while your
            published app still runs the older code.
          </p>
          <p className="mt-2 break-words">
            Migration:{" "}
            <code>supabase/migrations/20261029000000_employee_portal.sql</code>
          </p>
          {!setup ? (
            <Button
              type="button"
              className={`${outline} mt-3`}
              disabled={loading}
              onClick={loadSetup}
            >
              {loading ? "Loading…" : "Get setup SQL"}
            </Button>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" className={outline} onClick={copySetup}>
                  {copied ? "Copied" : "Copy setup SQL"}
                </Button>
                <a
                  className={outline}
                  href={setup.editor_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Supabase SQL editor
                </a>
              </div>
              <label className="mt-3 block">
                Setup SQL
                <textarea
                  className={`${field} mt-1 min-h-40 font-mono text-xs`}
                  readOnly
                  value={setup.sql}
                  rows={8}
                />
              </label>
            </>
          )}
          {setupError && (
            <p className="mt-2 text-sm text-destructive">{setupError}</p>
          )}
        </details>
      )}
      <Button onClick={retry} className={`${outline} mt-4`}>
        Retry
      </Button>
    </div>
  );
}
