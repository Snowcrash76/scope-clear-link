import { ChevronRight, Clock3, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  PortalAssignment,
  PortalJob,
} from "../../../shared/employeePortal";

import { card, primary, outline, fmtDate } from "./portalShared";

export function AssignmentCard({
  assignment,
  job,
  onClock,
  onOpen,
  busy = false,
}: {
  assignment: PortalAssignment;
  job?: PortalJob;
  onClock?: () => void;
  onOpen?: () => void;
  busy?: boolean;
}) {
  return (
    <article className={`${card} overflow-hidden`}>
      <div className="flex gap-3 p-4 sm:p-5">
        <div className="portal-mono flex w-[62px] shrink-0 flex-col items-center justify-center rounded-xl bg-muted py-2 text-xs text-muted-foreground">
          <b>{assignment.start_time?.slice(0, 5) || "—"}</b>
          <span className="my-1 h-px w-5 bg-muted" />
          <span>{assignment.end_time?.slice(0, 5) || "—"}</span>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <button type="button" className="block min-h-11 w-full text-left" onClick={onOpen}>
            <span className="block truncate text-base font-bold">
              {job?.name ?? "Scheduled job"}
            </span>
            <span className="mt-1 block truncate text-sm text-muted-foreground">
              {job?.client_name ?? ""}
            </span>
          </button>
          <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {job?.client_address ? (
              <a
                className="underline decoration-muted-foreground/40 underline-offset-2"
                href={`https://maps.google.com/?q=${encodeURIComponent(job.client_address)}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {job.client_address}
              </a>
            ) : "Address to be confirmed"}
          </span>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
        <span className="mr-auto text-xs text-muted-foreground">
          {fmtDate(assignment.date)}
        </span>
        {job?.client_phone && (
          <a
            className={`${outline} !min-h-10 !px-3`}
            href={`tel:${job.client_phone}`}
          >
            Call client
          </a>
        )}
        {onClock && (
          <Button
            className={`${primary} !min-h-10 !px-3`}
            disabled={busy}
            onClick={onClock}
          >
            <Clock3 className="h-4 w-4" />
            {busy ? "Starting…" : "Clock in"}
          </Button>
        )}
      </div>
    </article>
  );
}
