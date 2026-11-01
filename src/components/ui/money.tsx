export type GSTBasis = "ex GST" | "inc GST";

export function formatAUD(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function Money({
  value,
  basis,
  className = "",
  labelClassName = "",
}: {
  value: number | null | undefined;
  basis: GSTBasis;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 flex-wrap items-baseline gap-x-1 tabular-nums ${className}`}>
      <span className="break-words">{formatAUD(value)}</span>
      <span className={`text-xs font-normal text-muted-foreground ${labelClassName}`}>{basis}</span>
    </span>
  );
}

