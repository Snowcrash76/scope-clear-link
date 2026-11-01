export const MAX_ASSIGNMENT_DAYS = 31;

/** Calendar dates, not 24-hour shifts: daily local start/finish times are preserved. */
export function assignmentDates(start: string, end = start): string[] {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid assignment date.');
    const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) {
      throw new Error('Choose a valid assignment date.');
    }
    return milliseconds;
  };
  const first = parse(start);
  const last = parse(end || start);
  if (last < first) throw new Error('End date must be on or after the start date.');
  const count = (last - first) / 86_400_000 + 1;
  if (count > MAX_ASSIGNMENT_DAYS) throw new Error(`Assign up to ${MAX_ASSIGNMENT_DAYS} days at a time.`);
  return Array.from({ length: count }, (_, index) =>
    new Date(first + index * 86_400_000).toISOString().slice(0, 10));
}
