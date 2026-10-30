import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface JobSectionMenuProps {
  value: string;
  onValueChange: (value: string) => void;
  invoiceCount?: number;
  pendingVariationCount?: number;
  documentNotificationCount?: number;
}

const primarySections = [
  { value: "quote", label: "Quote" },
  { value: "costs", label: "Costs" },
  { value: "timesheets", label: "Timesheets" },
  { value: "invoices", label: "Invoices" },
  { value: "changes", label: "Variations" },
  { value: "activity", label: "Activity" },
] as const;

const secondarySections = [
  { value: "documents", label: "Documents" },
  { value: "stages", label: "Stages" },
  { value: "staff", label: "Team assignments" },
  { value: "employee-updates", label: "Team updates" },
] as const;

export function JobSectionMenu({
  value,
  onValueChange,
  invoiceCount = 0,
  pendingVariationCount = 0,
  documentNotificationCount = 0,
}: JobSectionMenuProps) {
  const selectedSecondary = secondarySections.find(
    (section) => section.value === value,
  );
  const notificationCount = (sectionValue: string) => {
    if (sectionValue === "invoices") return invoiceCount;
    if (sectionValue === "changes") return pendingVariationCount;
    if (sectionValue === "documents") return documentNotificationCount;
    return 0;
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
      <nav
        aria-label="Job sections"
        className="grid min-w-0 flex-1 grid-cols-3 gap-1 sm:flex sm:items-center"
      >
        {primarySections.map((section) => {
          const count = notificationCount(section.value);
          const selected = value === section.value;
          return (
            <button
              key={section.value}
              type="button"
              onClick={() => onValueChange(section.value)}
              aria-pressed={selected}
              className={cn(
                "min-h-11 min-w-0 rounded-lg px-1.5 text-sm font-semibold transition-colors sm:shrink-0 sm:px-3",
                selected
                  ? "bg-accent text-accent-foreground ring-1 ring-inset ring-ring"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              data-testid={`job-section-${section.value}`}
            >
              {section.label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 text-sm tabular-nums text-warning">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 gap-2 border-input bg-background px-3 text-sm text-foreground"
            aria-label={
              selectedSecondary
                ? `More sections, ${selectedSecondary.label}`
                : "More job sections"
            }
            data-testid="button-more-job-sections"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>{selectedSecondary?.label ?? "More"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-1.5"
        >
          <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-muted-foreground">
            More job sections
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={selectedSecondary?.value ?? ""}
            onValueChange={onValueChange}
          >
            {secondarySections.map((section) => (
              <DropdownMenuRadioItem
                key={section.value}
                value={section.value}
                className="min-h-11 cursor-pointer rounded-md py-2 pl-9 pr-3 text-sm"
              >
                <span>{section.label}</span>
                {section.value === "documents" &&
                  documentNotificationCount > 0 && (
                    <span
                      className="ml-auto rounded-full bg-warning/15 px-2 py-0.5 text-sm tabular-nums text-warning"
                      aria-label={`${documentNotificationCount} new documents`}
                    >
                      {documentNotificationCount}
                    </span>
                  )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
