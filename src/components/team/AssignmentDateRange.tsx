import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignmentDates } from "../../../shared/assignmentDates";
import { field } from "./portalShared";

type AssignmentDateRangeProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  startId: string;
  endId: string;
};

export function AssignmentDateRange({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startId,
  endId,
}: AssignmentDateRangeProps) {
  const range = useMemo(() => {
    if (!startDate) return { count: null, error: "" };
    try {
      return { count: assignmentDates(startDate, endDate).length, error: "" };
    } catch (error) {
      return {
        count: null,
        error: error instanceof Error ? error.message : "Choose a valid date range.",
      };
    }
  }, [startDate, endDate]);

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor={startId}>Start date</Label>
          <Input
            id={startId}
            type="date"
            className={`${field} mt-1.5`}
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={endId}>End date (optional)</Label>
          <Input
            id={endId}
            type="date"
            className={`${field} mt-1.5`}
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        The same start and finish times apply each day, including weekends.
        {range.count !== null
          ? ` ${range.count} ${range.count === 1 ? "day" : "days"} selected.`
          : ""}
      </p>
      {range.error && (
        <p className="mt-1 text-sm text-destructive" role="status">
          {range.error}
        </p>
      )}
    </div>
  );
}
