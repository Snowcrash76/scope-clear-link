import { formatHours } from "./format";
export function HoursCell({ minutes, className = "" }: { minutes: number; className?: string }) {
  return <span className={`font-body tabular-nums ${className}`}>{formatHours(minutes)}</span>;
}
