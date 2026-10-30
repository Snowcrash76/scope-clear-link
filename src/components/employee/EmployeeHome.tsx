import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CalendarDays, Clock3 } from "lucide-react";
import {
  usePortal,
  useRefreshPortal,
  portalRequest,
} from "@/hooks/useEmployeePortal";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import type { EmployeeBootstrap } from "../../../shared/employeePortal";

import {
  card,
  btn,
  outline,
  field,
  today,
  fmtDate,
  fmtTime,
  elapsed,
  getError,
} from "./portalShared";
import { LoadState } from "./LoadState";
import { PortalLayout } from "./PortalLayout";
import { PageTitle } from "./PageTitleView";
import { Empty } from "./Empty";
import { AssignmentCard } from "./AssignmentCard";

export function EmployeeHome({ week = false }: { week?: boolean }) {
  const path = "/employee/bootstrap";
  const q = usePortal<EmployeeBootstrap>(path);
  const refresh = useRefreshPortal();
  const nav = useNavigate();
  const data = q.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [gpsConsent, setGpsConsent] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState("30");
  const [shiftNote, setShiftNote] = useState("");
  const [clockOutError, setClockOutError] = useState("");
  const [clockOutBusy, setClockOutBusy] = useState(false);
  const assignments = useMemo(
    () =>
      (data?.assignments ?? [])
        .filter((a) => (week ? a.date >= data!.today : a.date === data!.today))
        .sort((a, b) =>
          `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`),
        ),
    [data, week],
  );
  const running = data?.entries.find((e) => !e.ended_at);
  const hasRunning = Boolean(running);
  useEffect(() => {
    if (!hasRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasRunning]);
  const getGps = async () =>
    gpsConsent && "geolocation" in navigator
      ? new Promise<{ latitude: number; longitude: number } | undefined>(
          (resolve) =>
            navigator.geolocation.getCurrentPosition(
              (p) =>
                resolve({
                  latitude: p.coords.latitude,
                  longitude: p.coords.longitude,
                }),
              () => resolve(undefined),
              { timeout: 3000, maximumAge: 60000 },
            ),
        )
      : undefined;
  async function clockIn(project_id: string) {
    setBusy(project_id);
    try {
      const gps = await getGps();
      await portalRequest("/employee/clock-in", {
        project_id,
        ...(gps ? { gps } : {}),
      });
      await refresh();
    } catch (e) {
      toast.error(getError(e));
    } finally {
      setBusy(null);
    }
  }
  async function clockOut(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!running) return;
    const break_minutes = Number(breakMinutes);
    if (
      breakMinutes.trim() === "" ||
      !Number.isInteger(break_minutes) ||
      break_minutes < 0
    ) {
      setClockOutError("Enter a whole number of break minutes, zero or more.");
      return;
    }
    setClockOutBusy(true);
    setClockOutError("");
    try {
      const gps = await getGps();
      await portalRequest("/employee/clock-out", {
        entry_id: running.id,
        break_minutes,
        notes: shiftNote,
        ...(gps ? { gps } : {}),
      });
      await refresh();
      setClockOutOpen(false);
      setBreakMinutes("30");
      setShiftNote("");
    } catch (e) {
      setClockOutError(getError(e));
    } finally {
      setClockOutBusy(false);
    }
  }
  return (
    <>
      <PortalLayout>
        <PageTitle
          eyebrow={week ? "Planning / next up" : "Field portal / today"}
          title={week ? "This week" : "Today"}
          description={
            week
              ? "Your upcoming booked work, in business local time."
              : "Your next job, contact details and work clock."
          }
          action={
            <Link className={outline} to="/employee/timesheets">
              <Clock3 className="h-4 w-4" />
              Timesheets
            </Link>
          }
        />
        {q.isLoading ? (
          <LoadState retry={() => q.refetch()} />
        ) : q.error ? (
          <LoadState error={q.error} retry={() => q.refetch()} />
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-[1.3fr_.7fr]">
              <div className={`${card} portal-grid p-5 sm:p-6`}>
                <p className="portal-mono text-xs uppercase tracking-[.15em] text-muted-foreground">
                  Business date · {data?.timezone}
                </p>
                <p className="mt-3 text-2xl font-bold text-muted-foreground">
                  {fmtDate(data?.today)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {assignments.length
                    ? `${assignments.length} scheduled ${assignments.length === 1 ? "job" : "jobs"}`
                    : "No assignments on the board yet."}
                </p>
              </div>
              <div
                className={`${card} flex flex-wrap items-center justify-between gap-3 p-5`}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Shift clock
                  </p>
                  <p className="mt-2 text-lg font-bold">
                    {running ? "On the clock" : "Not clocked in"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {running
                      ? `Started ${fmtTime(running.started_at, data?.timezone)} · ${elapsed(running.started_at, now)}`
                      : "Location stays off unless you opt in."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={gpsConsent}
                      onChange={(e) => setGpsConsent(e.target.checked)}
                    />
                    Include GPS
                  </label>
                  {running ? (
                    <Button
                      className={`${btn} bg-destructive text-destructive-foreground hover:bg-destructive/90`}
                      onClick={() => {
                        setClockOutError("");
                        setClockOutOpen(true);
                      }}
                    >
                      Clock out
                    </Button>
                  ) : (
                    <Clock3 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              </div>
            </section>
            {assignments.length === 0 ? (
              <Empty
                title={
                  week ? "Nothing booked just yet" : "You are clear for today"
                }
                detail="When your manager adds you to a job, it will appear here with the site and schedule."
              />
            ) : (
              <div className="grid gap-3">
                {assignments.map((a) => (
                  <AssignmentCard
                    key={a.id}
                    assignment={a}
                    job={data?.jobs.find((j) => j.id === a.project_id)}
                    onOpen={() => nav(`/employee/jobs/${a.project_id}`)}
                    onClock={!running ? () => clockIn(a.project_id) : undefined}
                    busy={busy === a.project_id}
                  />
                ))}
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className={outline} to="/employee/week">
                <CalendarDays className="h-4 w-4" />
                Upcoming work
              </Link>
              <Link className={outline} to="/employee/notifications">
                <Bell className="h-4 w-4" />
                Updates
              </Link>
            </div>
          </>
        )}
      </PortalLayout>
      <Dialog
        open={clockOutOpen}
        onOpenChange={(open) => {
          if (!clockOutBusy) setClockOutOpen(open);
        }}
      >
        <DialogContent>
          <form onSubmit={clockOut} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Clock out of this shift?</DialogTitle>
              <DialogDescription>
                Confirm your unpaid break and add an optional note before ending
                the running timer.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="clock-out-break">Unpaid break (minutes)</Label>
              <Input
                id="clock-out-break"
                type="number"
                inputMode="numeric"
                min="0"
                step="any"
                className={`${field} mt-1.5`}
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.target.value)}
                aria-invalid={!!clockOutError}
                aria-describedby={
                  clockOutError ? "clock-out-break-error" : undefined
                }
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="clock-out-note">Shift note (optional)</Label>
              <Textarea
                id="clock-out-note"
                className="mt-1.5 min-h-24"
                value={shiftNote}
                onChange={(event) => setShiftNote(event.target.value)}
                placeholder="Add context about this shift"
              />
            </div>
            {clockOutError && (
              <p
                id="clock-out-break-error"
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {clockOutError}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                className={outline}
                disabled={clockOutBusy}
                onClick={() => setClockOutOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={`${btn} bg-destructive text-destructive-foreground hover:bg-destructive/90`}
                disabled={clockOutBusy}
              >
                {clockOutBusy ? "Clocking out…" : "Clock out"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
