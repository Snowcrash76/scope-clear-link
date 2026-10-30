import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function InfoPopover({
  label,
  content,
  children,
  className,
  contentClassName,
  align = "start",
  testId,
}: {
  label: string;
  content: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  testId?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          data-testid={testId}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          {children ?? <Info className="h-4 w-4" aria-hidden="true" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className={cn("max-w-72 text-sm", contentClassName)}>
        {content}
      </PopoverContent>
    </Popover>
  );
}
