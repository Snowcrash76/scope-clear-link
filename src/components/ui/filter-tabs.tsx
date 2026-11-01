import type { ReactNode } from "react";

export interface FilterTabOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: ReactNode;
  testId?: string;
}

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label = "Filter",
  className = "",
}: {
  options: FilterTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 gap-2 overflow-x-auto border-0 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-0 md:shadow-[inset_0_-1px_0_#e2e8f0] ${className}`}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            type="button"
            key={option.value}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 !rounded-full border px-3 text-sm transition-colors md:!rounded-none md:border-x-0 md:border-t-0 md:border-b-2 md:px-4 ${
              active
                ? "border-[#2563EB] bg-blue-50 font-medium text-[#2563EB] md:relative md:z-10 md:bg-transparent"
                : "border-slate-200 bg-slate-100 font-normal text-slate-500 hover:text-slate-800 md:border-transparent md:bg-transparent"
            }`}
          >
            <span>{option.label}</span>
            {option.count != null && (
              <span
                className={`tabular-nums ${active ? "font-medium text-[#2563EB]" : "text-slate-500"}`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
