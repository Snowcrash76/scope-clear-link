import { useEffect, useRef } from "react";
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Coins,
  FileText,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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
  {
    label: "",
    items: [{ value: "overview", label: "Overview", icon: BriefcaseBusiness }],
  },
  {
    label: "Scope",
    items: [
      { value: "quote", label: "Quote", icon: ClipboardList },
      { value: "changes", label: "Variations", icon: Activity },
      { value: "stages", label: "Stages", icon: CalendarDays },
    ],
  },
  {
    label: "Money",
    items: [
      { value: "costs", label: "Costs", icon: Coins },
      { value: "invoices", label: "Invoices", icon: Wallet },
    ],
  },
  {
    label: "People & files",
    items: [
      { value: "staff", label: "Team", icon: Users },
      { value: "documents", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "",
    items: [{ value: "activity", label: "Activity", icon: Activity }],
  },
] as const;

export function JobSectionMenu({
  value,
  onValueChange,
  invoiceCount = 0,
  pendingVariationCount = 0,
  needsTradeResponseCount = 0,
  documentCount = 0,
  stageCount = 0,
  stageBadge,
}: JobSectionMenuProps) {
  const navRef = useRef<HTMLElement>(null);
  const countFor = (section: string) =>
    section === "invoices"
      ? invoiceCount
      : section === "changes"
        ? pendingVariationCount
        : section === "documents"
          ? documentCount
          : 0;
  const badgeText = (section: string) =>
    section === "stages" && stageCount > 0 ? stageBadge ?? `${stageCount}` : countFor(section);
  const setSection = (next: string) => {
    onValueChange(next);
  };

  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLButtonElement>('button[data-section-item][aria-current="page"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [value]);

  const renderItem = (section: { value: string; label: string; icon: LucideIcon }) => {
    const selected = section.value === value ||
      (section.value === "staff" && value === "employee-updates");
    const Icon = section.icon;
    const count = badgeText(section.value);
    return (
      <button
        key={section.value}
        type="button"
        onClick={() => setSection(section.value)}
        aria-current={selected ? "page" : undefined}
        aria-label={count !== 0
          ? section.value === "changes"
            ? `${pendingVariationCount} variations need action${needsTradeResponseCount > 0 ? `, including ${needsTradeResponseCount} needing your response` : ""}`
            : section.value === "stages"
              ? `Stages, ${count} progress`
              : `${section.label}, ${count} items`
          : section.label}
        className={cn(
          "flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
          "justify-start px-3",
          selected
            ? "bg-accent text-accent-foreground ring-1 ring-inset ring-primary/20"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        data-testid={`job-section-${section.value}`}
        data-section-item
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">{section.label}</span>
        {count !== 0 && (
          <span
            aria-hidden="true"
            className={cn(
              "ml-auto min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums",
              section.value === "changes"
                ? needsTradeResponseCount > 0
                  ? "bg-warning text-warning-foreground"
                  : "bg-warning/15 text-warning"
                : "bg-muted text-muted-foreground",
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
        className="job-section-scroll flex min-w-0 gap-1 overflow-x-auto border-b border-border bg-card px-1 py-2"
      >
        {groups.map((group, index) => (
          <div key={`${group.label}-${index}`} className="contents">
            {group.label && (
              <h2 className="hidden px-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {group.label}
              </h2>
            )}
            <div className="flex shrink-0 gap-1">
              {group.items.map((item) => {
                const element = renderItem(item);
                return (
                  <div key={item.value} className="contents">
                    {element}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="pointer-events-none absolute inset-y-2 left-0 w-4 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-2 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
