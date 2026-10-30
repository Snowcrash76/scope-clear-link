export const formatHours = (minutes: number) =>
  `${(minutes / 60).toFixed(1).replace(/\.0$/, "")} h`;

export const formatDuration = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(Math.abs(minutes % 60)).padStart(2, "0")}m`;

export function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

export function formatWeek(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const date = (d: Date) =>
    new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  const left = date(start);
  return `${left} – ${date(end)}`;
}

export const formatClock = (value: string | null, timezone: string) =>
  value
    ? new Intl.DateTimeFormat("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      })
        .format(new Date(value))
        .replace(" am", " am")
        .replace(" pm", " pm")
    : "Running";
