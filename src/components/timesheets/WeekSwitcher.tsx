import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatWeek } from "./format";
import { weekStart } from "../../../shared/employeePortal";
import { shiftWeek } from "./model";

export function WeekSwitcher({
  value,
  onChange,
  today,
  id = "timesheet-week",
}: {
  value: string;
  onChange: (week: string) => void;
  today?: string;
  id?: string;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const move = (amount: number) =>
    onChange(weekStart(shiftWeek(value, amount)));
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Week navigation"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11"
        aria-label="Previous week"
        onClick={() => move(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <strong className="min-w-[175px] flex-1 text-center text-sm sm:flex-none sm:text-base">
        {formatWeek(value)}
      </strong>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11"
        aria-label="Next week"
        onClick={() => move(1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {today && (
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => onChange(weekStart(today))}
        >
          This week
        </Button>
      )}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-11 p-0"
            aria-label="Choose a week"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-3 shadow-elevated"
        >
          <label className="block text-sm font-medium" htmlFor={id}>
            Choose a date
          </label>
          <input
            id={id}
            type="date"
            className="mt-2 min-h-11 rounded-lg border border-input bg-background px-3 text-foreground"
            value={value}
            onChange={(event) => {
              if (event.target.value) onChange(weekStart(event.target.value));
              setCalendarOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
