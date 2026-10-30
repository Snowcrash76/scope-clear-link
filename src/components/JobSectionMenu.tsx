import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface JobSectionMenuProps {
  value: string;
  onValueChange: (value: string) => void;
  invoiceCount?: number;
  pendingVariationCount?: number;
  documentNotificationCount?: number;
}

const primarySections = [
  { value: 'quote', label: 'Quote' },
  { value: 'costs', label: 'Costs' },
  { value: 'timesheets', label: 'Timesheets' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'changes', label: 'Variations' },
  { value: 'activity', label: 'Activity' },
] as const;

const secondarySections = [
  { value: 'documents', label: 'Documents' },
  { value: 'stages', label: 'Stages' },
  { value: 'staff', label: 'Team assignments' },
  { value: 'employee-updates', label: 'Team updates' },
] as const;

export function JobSectionMenu({
  value,
  onValueChange,
  invoiceCount = 0,
  pendingVariationCount = 0,
  documentNotificationCount = 0,
}: JobSectionMenuProps) {
  const selectedSecondary = secondarySections.find(section => section.value === value);
  const notificationCount = (sectionValue: string) => {
    if (sectionValue === 'invoices') return invoiceCount;
    if (sectionValue === 'changes') return pendingVariationCount;
    if (sectionValue === 'documents') return documentNotificationCount;
    return 0;
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <nav aria-label="Job sections" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
        {primarySections.map(section => {
          const count = notificationCount(section.value);
          const selected = value === section.value;
          return (
            <button
              key={section.value}
              type="button"
              onClick={() => onValueChange(section.value)}
              aria-pressed={selected}
              className={cn(
                'min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors',
                selected ? 'bg-amber-100 text-zinc-950 ring-1 ring-inset ring-amber-400' : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
              )}
              data-testid={`job-section-${section.value}`}
            >
              {section.label}
              {count > 0 && <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 text-sm tabular-nums text-zinc-950">{count}</span>}
            </button>
          );
        })}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 gap-2 border-zinc-400 bg-white px-3 text-sm text-zinc-900"
            aria-label={selectedSecondary ? `More sections, ${selectedSecondary.label}` : 'More job sections'}
            data-testid="button-more-job-sections"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{selectedSecondary?.label ?? 'More'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-1.5">
          <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-muted-foreground">More job sections</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={selectedSecondary?.value ?? ''} onValueChange={onValueChange}>
            {secondarySections.map(section => (
              <DropdownMenuRadioItem key={section.value} value={section.value} className="min-h-11 cursor-pointer rounded-md py-2 pl-9 pr-3 text-sm">
                <span>{section.label}</span>
                {section.value === 'documents' && documentNotificationCount > 0 && (
                  <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-sm tabular-nums text-zinc-950" aria-label={`${documentNotificationCount} new documents`}>
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
