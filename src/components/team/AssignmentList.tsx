import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  TeamBootstrap,
  PortalAssignment,
} from "../../../shared/employeePortal";

const card =
  "rounded-2xl border border-border bg-card shadow-[0_3px_14px_rgba(33,54,43,.045)]";
const outline =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent/20";
const showDate = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));

export function AssignmentList({
  team,
  remove,
  edit,
  filterJob,
}: {
  team: TeamBootstrap;
  remove: (id: string) => void;
  edit: (assignment: PortalAssignment) => void;
  filterJob?: string;
}) {
  const [removeTarget, setRemoveTarget] = useState<PortalAssignment | null>(
    null,
  );
  const items = team.assignments.filter(
    (assignment) => !filterJob || assignment.project_id === filterJob,
  );
  return (
    <AlertDialog
      open={!!removeTarget}
      onOpenChange={(open) => {
        if (!open) setRemoveTarget(null);
      }}
    >
      <section className={`${card} overflow-hidden`}>
        <div className="border-b border-border p-4">
          <h2 className="font-bold">Scheduled team</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} assignments
          </p>
        </div>
        {items.length ? (
          items.map((assignment) => (
            <div
              key={assignment.id}
              className="flex flex-wrap items-center gap-3 border-b border-border p-4 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">
                  {assignment.employee_name ??
                    team.employees.find(
                      (employee) => employee.id === assignment.employee_id,
                    )?.name ??
                    "Team member"}
                </b>
                <span className="block truncate text-sm text-muted-foreground">
                  {
                    team.jobs.find((job) => job.id === assignment.project_id)
                      ?.name
                  }{" "}
                  · {showDate(assignment.date)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {assignment.start_time}–{assignment.end_time}
                </span>
              </div>
              <Button className={outline} onClick={() => edit(assignment)}>
                Edit schedule
              </Button>
              <Button
                className={outline}
                onClick={() => setRemoveTarget(assignment)}
              >
                Remove
              </Button>
            </div>
          ))
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No team members scheduled. Assign one or more team members to an
            existing job.
          </p>
        )}
      </section>
      <AlertDialogContent>
        <AlertDialogTitle>Remove this scheduled assignment?</AlertDialogTitle>
        <AlertDialogDescription>
          This removes the team member from this appointment. It does not remove
          their team profile or work history.
        </AlertDialogDescription>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel className={outline}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (removeTarget) remove(removeTarget.id);
              setRemoveTarget(null);
            }}
          >
            Remove assignment
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
