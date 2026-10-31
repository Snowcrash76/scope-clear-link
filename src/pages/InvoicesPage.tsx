import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { PageLayout } from "@/components/PageLayout";
import { LoadErrorState } from "@/components/LoadErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Receipt,
  ChevronRight,
  Download,
  CalendarRange,
  X,
  ListFilter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  endOfDay,
} from "date-fns";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

const ALL_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

const STATUS_VARIANTS: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

interface InvoiceRow {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total: number | null;
  due_date: string | null;
  created_at: string;
  project_id: string;
  projectName: string;
  clientName: string;
}

function useAllInvoices() {
  const { user } = useAuth();
  return useQuery<InvoiceRow[]>({
    queryKey: ["/invoices/all", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: projects, error: pe } = await supabase
        .from("projects")
        .select("id, name, client_name")
        .eq("user_id", user!.id);
      if (pe) throw pe;
      if (!projects?.length) return [];

      const projectMap = new Map(projects.map((p) => [p.id, p]));
      const ids = projects.map((p) => p.id);

      const { data: invoices, error: ie } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, status, total, due_date, created_at, project_id",
        )
        .in("project_id", ids)
        .order("created_at", { ascending: false });
      if (ie) throw ie;

      return (invoices ?? []).map((inv) => ({
        ...inv,
        status: inv.status as InvoiceStatus,
        projectName: projectMap.get(inv.project_id)?.name ?? "",
        clientName: projectMap.get(inv.project_id)?.client_name ?? "",
      }));
    },
    staleTime: 30_000,
  });
}

const formatCurrency = (n: number | null) =>
  n == null
    ? "—"
    : `$${n.toLocaleString("en-AU", { minimumFractionDigits: 0 })}`;

function exportInvoicesCSV(rows: InvoiceRow[]) {
  const headers = [
    "Invoice #",
    "Job",
    "Client",
    "Status",
    "Total (AUD)",
    "Due Date",
    "Created Date",
  ];
  const csvRows = rows.map((inv) => [
    inv.invoice_number,
    inv.projectName,
    inv.clientName,
    STATUS_LABELS[inv.status],
    inv.total != null ? inv.total.toFixed(2) : "",
    inv.due_date ? format(parseISO(inv.due_date), "dd/MM/yyyy") : "",
    format(parseISO(inv.created_at), "dd/MM/yyyy"),
  ]);

  const csvContent = [headers, ...csvRows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoices-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseInvoiceStatusParam(value: string | null): Set<InvoiceStatus> {
  if (value === "unpaid") return new Set(["sent", "overdue"]);
  return new Set(
    (value ?? "")
      .split(",")
      .filter((status): status is InvoiceStatus =>
        ALL_STATUSES.includes(status as InvoiceStatus),
      ),
  );
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceQuery = useAllInvoices();
  const { data: invoices, isLoading, isError, refetch } = invoiceQuery;

  // Date filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Status filter — empty set means "show all"
  const statusParam = searchParams.get("status");
  const [statusFilter, setStatusFilter] = useState<Set<InvoiceStatus>>(() =>
    parseInvoiceStatusParam(statusParam),
  );
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  useEffect(() => {
    setStatusFilter(parseInvoiceStatusParam(statusParam));
  }, [statusParam]);

  const isDateFiltered = !!dateFrom || !!dateTo;
  const isStatusFiltered = statusFilter.size > 0;
  const isFiltered = isDateFiltered || isStatusFiltered;

  const commitStatusFilter = (next: Set<InvoiceStatus>) => {
    setStatusFilter(next);
    const params = new URLSearchParams(searchParams);
    if (next.size) params.set("status", [...next].join(","));
    else params.delete("status");
    setSearchParams(params, { replace: true });
  };

  const toggleStatus = (s: InvoiceStatus) => {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    commitStatusFilter(next);
  };

  const filtered = (invoices ?? []).filter((inv) => {
    if (isStatusFiltered && !statusFilter.has(inv.status)) return false;
    if (isDateFiltered) {
      const created = parseISO(inv.created_at);
      if (dateFrom && dateTo) {
        return isWithinInterval(created, {
          start: startOfDay(parseISO(dateFrom)),
          end: endOfDay(parseISO(dateTo)),
        });
      }
      if (dateFrom) return created >= startOfDay(parseISO(dateFrom));
      if (dateTo) return created <= endOfDay(parseISO(dateTo));
    }
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const pageInvoices = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const outstanding = (invoices ?? [])
    .filter((invoice) => invoice.status === "sent" || invoice.status === "overdue")
    .reduce((sum, invoice) => sum + (invoice.total ?? 0), 0);
  const overdueTotal = (invoices ?? [])
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + (invoice.total ?? 0), 0);

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
    setDateFilterOpen(false);
  };

  const clearStatusFilter = () => {
    commitStatusFilter(new Set());
    setStatusFilterOpen(false);
  };

  const clearAll = () => {
    clearDateFilter();
    clearStatusFilter();
  };

  const statusFilterLabel = () => {
    if (statusFilter.size === 0) return "Status";
    if (statusFilter.size === 1) return STATUS_LABELS[[...statusFilter][0]];
    return `${statusFilter.size} statuses`;
  };

  return (
    <AppShell>
      <PageLayout title="Invoices" eyebrow="BILLING & REVENUE OPERATIONS" description="Track issued invoices and recorded payment status across your jobs.">
        {!isError && (
          <section className="mb-6 grid gap-3 sm:grid-cols-2" aria-label="Invoice overview">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
              <span className="absolute inset-x-0 top-0 h-[3px] bg-primary" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">Outstanding receivables · inc GST</p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{isLoading ? "—" : formatCurrency(outstanding)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Recorded totals on sent and overdue invoices.</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
              <span className="absolute inset-x-0 top-0 h-[3px] bg-destructive" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">Overdue · inc GST</p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{isLoading ? "—" : formatCurrency(overdueTotal)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{(invoices ?? []).filter((invoice) => invoice.status === "overdue").length} invoices marked overdue.</p>
            </div>
          </section>
        )}
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border [-webkit-overflow-scrolling:touch]" role="group" aria-label="Invoice status tabs">
          {(["all", "draft", "sent", "paid", "overdue"] as const).map((tab) => {
            const count = tab === "all" ? (invoices ?? []).length : (invoices ?? []).filter((invoice) => invoice.status === tab).length;
            const active = tab === "all" ? !isStatusFiltered : statusFilter.size === 1 && statusFilter.has(tab);
            return <button key={tab} type="button" aria-pressed={active}
              onClick={() => commitStatusFilter(tab === "all" ? new Set() : new Set([tab]))}
              className={cn("min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium capitalize transition-colors", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {tab === "sent" ? "Awaiting payment" : tab === "all" ? "All" : STATUS_LABELS[tab]} <span className="ml-1 tabular-nums text-muted-foreground">{count}</span>
            </button>;
          })}
        </div>
        <div className="mb-5 flex w-full items-center gap-2 flex-wrap sm:justify-end">
          {/* Status filter */}
          <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={isStatusFiltered ? "default" : "outline"}
                size="sm"
                className="min-h-11 flex-1 gap-2 sm:flex-none"
                data-testid="button-invoice-status-filter"
              >
                <ListFilter className="w-4 h-4" />
                {statusFilterLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3 space-y-2" align="end">
              <p className="text-sm font-semibold mb-1">Filter by status</p>
              {ALL_STATUSES.map((s) => (
                <div key={s} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`status-filter-${s}`}
                    checked={statusFilter.has(s)}
                    onCheckedChange={() => toggleStatus(s)}
                    data-testid={`checkbox-status-${s}`}
                  />
                  <label
                    htmlFor={`status-filter-${s}`}
                    className="flex items-center gap-2 cursor-pointer select-none text-sm"
                  >
                    <span
                      className={cn(
                        "inline-flex px-1.5 py-0.5 rounded text-xs font-semibold",
                        STATUS_VARIANTS[s],
                      )}
                    >
                      {STATUS_LABELS[s]}
                    </span>
                  </label>
                </div>
              ))}
              {isStatusFiltered && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 mt-1"
                  onClick={clearStatusFilter}
                  data-testid="button-status-filter-clear"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {/* Date filter */}
          <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={isDateFiltered ? "default" : "outline"}
                size="sm"
                className="min-h-11 flex-1 gap-2 sm:flex-none"
                data-testid="button-invoice-filter"
              >
                <CalendarRange className="w-4 h-4" />
                {isDateFiltered ? (
                  <span>
                    {dateFrom && dateTo
                      ? `${format(parseISO(dateFrom), "d MMM")} – ${format(parseISO(dateTo), "d MMM yyyy")}`
                      : dateFrom
                        ? `From ${format(parseISO(dateFrom), "d MMM yyyy")}`
                        : `Until ${format(parseISO(dateTo), "d MMM yyyy")}`}
                  </span>
                ) : (
                  "Date"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 space-y-4" align="end">
              <p className="text-sm font-semibold">Filter by created date</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-date-from" className="text-xs">
                    From
                  </Label>
                  <input
                    id="inv-date-from"
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    data-testid="input-invoice-date-from"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-date-to" className="text-xs">
                    To
                  </Label>
                  <input
                    id="inv-date-to"
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    data-testid="input-invoice-date-to"
                  />
                </div>
              </div>
              {isDateFiltered && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2"
                  onClick={clearDateFilter}
                  data-testid="button-invoice-filter-clear"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear dates
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {/* Clear all badge */}
          {isFiltered && (
            <button
              onClick={clearAll}
              className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-muted transition-colors"
              title="Clear all filters"
              data-testid="button-invoice-filter-clear-badge"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 w-full gap-2 sm:w-auto"
            disabled={isLoading || filtered.length === 0}
            onClick={() => exportInvoicesCSV(filtered)}
            data-testid="button-invoice-export-csv"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Active filter summary */}
        {isFiltered && !isLoading && !isError && (
          <p className="text-sm text-muted-foreground mb-4">
            Showing{" "}
            <span className="font-medium text-foreground">
              {filtered.length}
            </span>{" "}
            of {invoices?.length ?? 0} invoices
            {isStatusFiltered && (
              <span>
                {" "}
                · {[...statusFilter].map((s) => STATUS_LABELS[s]).join(", ")}
              </span>
            )}
          </p>
        )}

        <div className="min-w-0 rounded-2xl border border-border bg-card overflow-hidden shadow-card">
          {/* Table header — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(90px,140px)_minmax(76px,100px)_minmax(84px,100px)_minmax(76px,100px)_16px] gap-3 lg:gap-4 px-4 py-2.5 border-b bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Job / Client
            </span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Invoice #
            </span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status
            </span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">
              Total · inc GST
            </span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Due
            </span>
            <span />
          </div>

          {isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-4 sm:p-6">
              <LoadErrorState
                title="Invoices could not be loaded"
                description="A failed invoice request is not an empty invoice list."
                onRetry={refetch}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {isFiltered
                  ? "No invoices match the selected filters."
                  : "No invoices yet. Invoices are created from within a project."}
              </p>
              {isFiltered && (
                <button
                  onClick={clearAll}
                  className="text-sm text-primary font-medium mt-2 hover:opacity-70 transition-opacity"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {pageInvoices.map((inv) => (
                <button
                  type="button"
                  key={inv.id}
                  onClick={() =>
                    navigate(`/manage/${inv.project_id}?tab=invoices`)
                  }
                  aria-label={`Open invoice ${inv.invoice_number} for ${inv.projectName}`}
                  className="block w-full cursor-pointer text-left transition-colors hover:bg-muted/40 group"
                  data-testid={`invoice-row-${inv.id}`}
                >
                  {/* Mobile layout */}
                  <div className="flex items-center gap-3 px-4 py-3.5 sm:hidden">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-words">
                        {inv.projectName}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {inv.clientName} ·{" "}
                        {format(parseISO(inv.created_at), "d MMM yyyy")}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold capitalize",
                            STATUS_VARIANTS[inv.status],
                          )}
                        >
                          {inv.status}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {formatCurrency(inv.total)} inc GST
                        </span>
                        {inv.due_date && (
                          <span className="text-xs text-muted-foreground">
                            · Due {format(parseISO(inv.due_date), "d MMM")}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(90px,140px)_minmax(76px,100px)_minmax(84px,100px)_minmax(76px,100px)_16px] gap-3 lg:gap-4 px-4 py-3.5 items-center">
                    <div>
                      <p className="text-sm font-medium break-words [overflow-wrap:anywhere]">
                        {inv.projectName}
                      </p>
                      <p className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                        {inv.clientName} ·{" "}
                        {format(parseISO(inv.created_at), "d MMM yyyy")}
                      </p>
                    </div>
                    <span className="min-w-0 break-words [overflow-wrap:anywhere] text-sm text-muted-foreground font-mono">
                      {inv.invoice_number}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize w-fit",
                        STATUS_VARIANTS[inv.status],
                      )}
                    >
                      {inv.status}
                    </span>
                      <span className="text-sm font-semibold text-right tabular-nums">
                       {formatCurrency(inv.total)}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">inc GST</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {inv.due_date
                        ? format(parseISO(inv.due_date), "d MMM yyyy")
                        : "—"}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {!isLoading && !isError && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Showing {filtered.length === 0 ? 0 : (currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, filtered.length)} of {filtered.length} invoices</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="min-h-11" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
              <span aria-label={`Page ${currentPage} of ${pageCount}`} className="tabular-nums">Page {currentPage} of {pageCount}</span>
              <Button variant="outline" className="min-h-11" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
        )}
      </PageLayout>
    </AppShell>
  );
}
