import { Menu } from 'lucide-react';
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

export interface JobSectionMenuProps {
  value: string;
  onValueChange: (value: string) => void;
  invoiceCount?: number;
  pendingVariationCount?: number;
  documentNotificationCount?: number;
}

const sections = [
  { value: 'quote', label: 'Quote' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'costs', label: 'Costs' },
  { value: 'changes', label: 'Variations' },
  { value: 'stages', label: 'Stages' },
  { value: 'documents', label: 'Documents' },
] as const;

export function JobSectionMenu({
  value,
  onValueChange,
  invoiceCount = 0,
  pendingVariationCount = 0,
  documentNotificationCount = 0,
}: JobSectionMenuProps) {
  const currentLabel = sections.find((section) => section.value === value)?.label ?? 'Quote';

  const notificationCount = (sectionValue: string) => {
    if (sectionValue === 'invoices') return invoiceCount;
    if (sectionValue === 'changes') return pendingVariationCount;
    if (sectionValue === 'documents') return documentNotificationCount;
    return 0;
  };

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 max-w-full justify-start gap-2 border-zinc-200 bg-white px-3 text-left shadow-sm hover:bg-zinc-50"
            aria-label={`Job sections, ${currentLabel}`}
          >
            <Menu className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-medium">{currentLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-1.5"
        >
          <DropdownMenuLabel className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Job sections
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
            {sections.map((section) => {
              const count = notificationCount(section.value);
              return (
                <DropdownMenuRadioItem
                  key={section.value}
                  value={section.value}
                  className="min-h-11 cursor-pointer rounded-md py-2 pl-9 pr-3 text-sm"
                >
                  <span>{section.label}</span>
                  {count > 0 && (
                    <span
                      className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
                      aria-label={`${count} ${section.label.toLowerCase()} notifications`}
                    >
                      {count}
                    </span>
                  )}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}
