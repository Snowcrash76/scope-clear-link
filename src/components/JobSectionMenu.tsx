import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Coins,
  FileText,
  Users,
  Wallet,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  const [allOpen, setAllOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1024,
  );
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
    setAllOpen(false);
  };

  useEffect(() => {
    const sync = () => setIsNarrow(window.innerWidth < 1024);
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (isNarrow) {
      navRef.current
        ?.querySelector<HTMLButtonElement>('button[data-section-item][aria-current="page"]')
        ?.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, [isNarrow, value, allOpen]);

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
          "lg:w-full lg:justify-start lg:px-3",
          selected
            ? "bg-primary/15 text-foreground ring-1 ring-inset ring-primary/45"
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
    <div className="relative min-w-0 lg:sticky lg:top-4 lg:self-start">
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
        className="job-section-scroll flex min-w-0 gap-1 overflow-x-auto border-b border-border bg-background/95 px-1 py-2 lg:max-h-[calc(100dvh-2rem)] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:overflow-x-hidden lg:border-0 lg:bg-transparent lg:px-0 lg:py-0"
      >
        {groups.map((group, index) => (
          <div key={`${group.label}-${index}`} className="contents lg:block">
            {group.label && (
              <h2 className="hidden px-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground lg:mb-1 lg:block">
                {group.label}
              </h2>
            )}
            <div className="flex shrink-0 gap-1 lg:flex-col">
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
      <div className="pointer-events-none absolute inset-y-2 left-0 w-4 bg-gradient-to-r from-background to-transparent lg:hidden" />
      <div className="pointer-events-none absolute inset-y-2 right-0 w-8 bg-gradient-to-l from-background to-transparent lg:hidden" />
      <Button
        type="button"
        variant="outline"
        className="mt-2 min-h-11 w-full gap-2 lg:hidden"
        onClick={() => setAllOpen(true)}
      >
        <LayoutGrid className="h-4 w-4" />
        All sections
      </Button>
      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="inset-0 flex h-[100dvh] w-screen max-h-none max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-0 p-5 sm:max-h-none sm:max-w-none sm:rounded-none lg:inset-auto lg:left-1/2 lg:top-1/2 lg:h-auto lg:max-h-[85dvh] lg:w-[min(44rem,calc(100vw-2rem))] lg:max-w-[44rem] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border">
          <DialogTitle className="text-xl">All job sections</DialogTitle>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-2">
            {groups.map((group, index) => (
              <section key={`${group.label}-${index}`} aria-label={group.label || "Overview"}>
                {group.label && (
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {group.label}
                  </h3>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => (
                    <div key={item.value}>{renderItem(item)}</div>
                  ))}
                </div>
              </section>
            ))}
            <section aria-label="Team views">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Team views</h3>
              <div className="grid grid-cols-2 gap-2">
                {renderItem({ value: "staff", label: "Assignments", icon: Users })}
                {renderItem({ value: "employee-updates", label: "Updates", icon: Activity })}
              </div>
            </section>
          </div>
          <Button variant="outline" className="min-h-11 w-full" onClick={() => setAllOpen(false)}>Close sections</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
