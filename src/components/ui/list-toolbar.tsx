import type { ReactNode } from "react";
import { SearchInput } from "@/components/ui/search-overlay";

export function ListToolbar({
  value,
  onChange,
  placeholder,
  name,
  testId,
  actions,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  name?: string;
  testId?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center" data-testid="list-toolbar">
      <SearchInput
        className="w-full flex-1"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        name={name}
        testId={testId}
      />
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export function ResultCount({
  count,
  singular,
  plural,
  children,
}: {
  count: number;
  singular: string;
  plural?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm text-slate-500" aria-live="polite" data-testid="list-result-count">
      <p>{count} {count === 1 ? singular : plural ?? `${singular}s`}</p>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
