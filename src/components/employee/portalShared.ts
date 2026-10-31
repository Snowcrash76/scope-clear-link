import { portalRequest } from "@/hooks/useEmployeePortal";

import { toast } from "sonner";

import { localDate } from "../../../shared/employeePortal";

export const shell = "portal-shell";

export const card =
  "rounded-2xl border border-border bg-card shadow-card";

export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50";

export const primary = `${btn} bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

export const outline = `${btn} border border-input bg-background text-foreground hover:bg-accent/20`;

export const field =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

export const today = () => localDate(new Date(), "Australia/Sydney");

export const fmtDate = (s?: string) =>
  s
    ? new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date(`${s.slice(0, 10)}T12:00:00`))
    : "";

export const fmtTime = (s?: string | null, timezone = "Australia/Sydney") =>
  s
    ? new Intl.DateTimeFormat("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(s))
    : "";

export const datetimeForZone = (value: string, zone: string) => {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
};

export const mins = (n: number) =>
  `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, "0")}m`;

export const elapsed = (from: string, to: number) => {
  const seconds = Math.max(0, Math.floor((to - Date.parse(from)) / 1000));
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
};

export const getError = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";

export async function openCapabilityUrl(path: string) {
  const viewer = window.open("about:blank", "_blank");
  if (viewer) viewer.opener = null;
  try {
    if (!viewer)
      throw new Error(
        "Your browser blocked the document window. Allow pop-ups and try again.",
      );
    const response = await portalRequest<{ url: string }>(
      path,
      undefined,
      "GET",
    );
    viewer.location.href = response.url;
  } catch (error) {
    viewer?.close();
    toast.error(getError(error));
  }
}
