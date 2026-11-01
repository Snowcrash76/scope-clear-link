import { format, isValid, parseISO } from "date-fns";

function asDate(value: Date | string): Date {
  return typeof value === "string" ? parseISO(value) : value;
}

export function formatShortDate(value: Date | string): string {
  const date = asDate(value);
  return isValid(date) ? format(date, "EEE d MMM") : "—";
}

export function formatFullDate(value: Date | string): string {
  const date = asDate(value);
  return isValid(date) ? format(date, "d MMM yyyy") : "—";
}
