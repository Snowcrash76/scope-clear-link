import type {
  TeamBootstrap,
  EmployeeRole,
} from "../../../shared/employeePortal";

export const card =
  "rounded-2xl border border-border bg-background shadow-[0_3px_14px_rgba(33,54,43,.045)]";

export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50";

export const primary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

export const outline = `${btn} border border-input bg-background text-foreground hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

export const field =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please retry.";

export const showDate = (s: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${s.slice(0, 10)}T12:00:00`));

export const showTime = (s: string | null, timezone = "Australia/Sydney") =>
  s
    ? new Intl.DateTimeFormat("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(s))
    : "Running";

export function trapModalFocus(
  event: React.KeyboardEvent<HTMLDivElement>,
  close: () => void,
  busy = false,
) {
  if (event.key === "Escape") {
    if (!busy) {
      event.preventDefault();
      close();
    }
    return;
  }
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget.querySelector<HTMLElement>(
    '[role="dialog"],[role="alertdialog"]',
  );
  const focusable = dialog
    ? Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0)
    : [];
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (!dialog?.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  }
}

export function roleLabelsLocal(r: EmployeeRole) {
  return r === "supervisor"
    ? "Leading Hand / Supervisor"
    : r === "admin"
      ? "Admin"
      : "Labourer";
}

export function employeeName(team: TeamBootstrap, employeeId: string) {
  return (
    team.employees.find((employee) => employee.id === employeeId)?.name ??
    "this team member"
  );
}

export function datetimeForTimezone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
