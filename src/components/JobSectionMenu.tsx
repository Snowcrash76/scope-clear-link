import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface JobSectionMenuProps {
  value: string;
  onValueChange: (value: string) => void;
  invoiceCount?: number;
  pendingVariationCount?: number;
  needsTradeResponseCount?: number;
  documentCount?: number;
  stageCount?: number;
  stageBadge?: string;
}

const groups = [
  { value: "overview", label: "Overview" },
  { value: "quote", label: "Quote" },
  { value: "changes", label: "Variations" },
  { value: "stages", label: "Stages" },
  { value: "costs", label: "Costs" },
  { value: "invoices", label: "Invoices" },
  { value: "staff", label: "Team" },
  { value: "documents", label: "Documents" },
  { value: "activity", label: "Activity" },
] as const;

export function JobSectionMenu({
  value,
  onValueChange,
  invoiceCount = 0,
  pendingVariationCount = 0,
  needsTradeResponseCount = 0,
}: JobSectionMenuProps) {
  const navRef = useRef<HTMLElement>(null);
  const countFor = (section: string) => section === "invoices"
    ? invoiceCount
    : section === "changes" ? pendingVariationCount : 0;
  const setSection = (next: string) => {
    onValueChange(next);
  };

  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLButtonElement>('button[data-section-item][aria-current="page"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [value]);

  const renderItem = (section: { value: string; label: string }) => {
    const selected = section.value === value ||
      (section.value === "staff" && value === "employee-updates");
    const count = countFor(section.value);
    return (
      <button
        key={section.value}
        type="button"
        onClick={() => setSection(section.value)}
        onFocus={(event) => {
          event.currentTarget.scrollIntoView({
            inline: "nearest",
            block: "nearest",
            behavior: "smooth",
          });
        }}
        aria-current={selected ? "page" : undefined}
        aria-label={count !== 0
          ? section.value === "changes"
            ? `${pendingVariationCount} variations need action${needsTradeResponseCount > 0 ? `, including ${needsTradeResponseCount} needing your response` : ""}`
            : section.value === "stages"
              ? `Stages, ${count} progress`
              : `${section.label}, ${count} items`
          : section.label}
        className={cn(
          "relative flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
          selected
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
        data-testid={`job-section-${section.value}`}
        data-section-item
      >
        <span className="whitespace-nowrap">{section.label}</span>
        {count !== 0 && (
          <span
            aria-hidden="true"
            className={cn(
              "min-w-5 rounded-full bg-warning/15 px-1.5 py-0.5 text-center text-xs tabular-nums text-warning-foreground",
            )}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="relative min-w-0">
      <nav
        ref={navRef}
        aria-label="Job sections"
        onKeyDown={(event) => {
          const buttons = Array.from(
            navRef.current?.querySelectorAll<HTMLButtonElement>("button[data-section-item]") ?? [],
          );
          const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
          if (!buttons.length || current < 0) return;
          const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
          if (!direction) return;
          event.preventDefault();
          buttons[(current + direction + buttons.length) % buttons.length]?.focus();
        }}
        className="job-section-scroll flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain scroll-smooth scroll-px-3 border-b border-border bg-transparent px-0"
      >
        {groups.map(renderItem)}
      </nav>
    </div>
  );
}
