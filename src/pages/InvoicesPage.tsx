import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { PageLayout } from "@/components/PageLayout";
import { KpiCard } from "@/components/KpiCard";
import { ListPagination } from "@/components/ListPagination";
import { LoadErrorState } from "@/components/LoadErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { invoiceDisplayStatus } from "@/lib/invoiceWorkflow";
import { Money } from "@/components/ui/money";
import { formatFullDate } from "@/lib/dateFormat";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { DeleteResourceDialog } from "@/components/DeleteResourceDialog";
import { Trash2 } from "lucide-react";
import { ListToolbar, ResultCount } from "@/components/ui/list-toolbar";
import { useListSearchParams } from "@/hooks/useListSearchParams";
import {
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  endOfDay,
} from "date-fns";

type InvoiceStatus = "draft" | "approved" | "sent" | "paid" | "overdue" | "cancelled";

const ALL_STATUSES: InvoiceStatus[] = [
  "draft",
  "approved",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Pending approval",
  approved: "Approved",
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
          "id, invoice_number, status, approved_at, total, due_date, created_at, project_id",
        )
        .in("project_id", ids)
        .order("created_at", { ascending: false });
      if (ie) throw ie;

      return (invoices ?? []).map((inv) => ({
        ...inv,
        status: invoiceDisplayStatus(inv.status, inv.approved_at) as InvoiceStatus,
        projectName: projectMap.get(inv.project_id)?.name ?? "",
        clientName: projectMap.get(inv.project_id)?.client_name ?? "",
      }));
    },
    staleTime: 30_000,
  });
}

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
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { search, debouncedSearch, setSearch } = useListSearchParams();
  const invoiceQuery = useAllInvoices();
  const { data: invoices, isLoading, isError, refetch } = invoiceQuery;

  // Date filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [debouncedSearch, dateFrom, dateTo]);

  // Status filter — empty set means "show all"
  const statusParam = searchParams.get("status");
  const statusFilter = parseInvoiceStatusParam(statusParam);

  const isDateFiltered = !!dateFrom || !!dateTo;
  const isStatusFiltered = statusFilter.size > 0;
  const isFiltered = isDateFiltered || isStatusFiltered;

  const commitStatusFilter = (next: Set<InvoiceStatus>, clearDates = false) => {
    if (clearDates) {
      setDateFrom("");
      setDateTo("");
    }
    const params = new URLSearchParams(searchParams);
    if (next.size) params.set("status", [...next].join(","));
    else params.delete("status");
    setSearchParams(params, { replace: true });
  };

  const term = debouncedSearch.trim().toLocaleLowerCase();
  const matchesSearch = (inv: InvoiceRow) =>
    !term || [inv.projectName, inv.clientName, inv.invoice_number]
      .some((value) => value?.toLocaleLowerCase().includes(term));
  const dateAndSearchFiltered = (invoices ?? []).filter((inv) => {
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
  }).filter(matchesSearch);
  const filtered = dateAndSearchFiltered.filter((inv) =>
    !isStatusFiltered || statusFilter.has(inv.status)
  );
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

  return (
    <AppShell>
      <PageLayout title="Invoices" description="Track issued invoices and recorded payment status across your jobs.">
        {!isError && (
          <section className="mb-6 grid gap-3 sm:grid-cols-2" aria-label="Invoice overview">
            <KpiCard label="Outstanding receivables" value={isLoading || isError ? "—" : <Money value={outstanding} basis="inc GST" />}
              description="Recorded totals on sent and overdue invoices."
              definition="Saved invoice totals including GST for invoices marked sent or overdue. Select to filter the list."
              onClick={() => commitStatusFilter(new Set<InvoiceStatus>(["sent", "overdue"]), true)} />
            <KpiCard label="Overdue" tone="warning" value={isLoading || isError ? "—" : <Money value={overdueTotal} basis="inc GST" />}
              description={isLoading || isError ? "Invoice totals are not available yet." : `${(invoices ?? []).filter((invoice) => invoice.status === "overdue").length} invoices marked overdue.`}
              definition="Saved total including GST for invoices explicitly marked overdue. No unrecorded payment dates are assumed."
              onClick={() => commitStatusFilter(new Set<InvoiceStatus>(["overdue"]), true)} />
          </section>
        )}
        <ListToolbar
          name="invoice-list-search"
          testId="input-invoice-list-search"
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          placeholder="Search invoices, clients or references"
          actions={
            <>
              <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={isDateFiltered ? "default" : "outline"}
                    size="sm"
                    className="min-h-11 gap-2"
                    data-testid="button-invoice-filter"
                  >
                    <CalendarRange className="h-4 w-4" />
                    {isDateFiltered ? (
                      <span>
                        {dateFrom && dateTo
                          ? `${format(parseISO(dateFrom), "d MMM")} – ${format(parseISO(dateTo), "d MMM yyyy")}`
                          : dateFrom
                            ? `From ${format(parseISO(dateFrom), "d MMM yyyy")}`
                            : `Until ${format(parseISO(dateTo), "d MMM yyyy")}`}
                      </span>
                    ) : "Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 space-y-4 p-4" align="end">
                  <p className="text-sm font-semibold">Filter by created date</p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-date-from" className="text-xs">From</Label>
                      <input id="inv-date-from" type="date" value={dateFrom} max={dateTo || undefined}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        data-testid="input-invoice-date-from" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-date-to" className="text-xs">To</Label>
                      <input id="inv-date-to" type="date" value={dateTo} min={dateFrom || undefined}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        data-testid="input-invoice-date-to" />
                    </div>
                  </div>
                  {isDateFiltered && <Button variant="ghost" size="sm" className="w-full gap-2"
                    onClick={clearDateFilter} data-testid="button-invoice-filter-clear">
                    <X className="h-3.5 w-3.5" />Clear dates
                  </Button>}
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" className="min-h-11 gap-2"
                disabled={isLoading || filtered.length === 0}
                onClick={() => exportInvoicesCSV(filtered)} data-testid="button-invoice-export-csv">
                <Download className="h-4 w-4" />Export CSV
              </Button>
            </>
          }
        />
        <FilterTabs
          label="Filter invoices by status"
          className="mb-4"
          value={!isStatusFiltered ? "all" : statusFilter.size === 1 ? [...statusFilter][0] : "__multiple__"}
          onChange={(tab) => { commitStatusFilter(tab === "all" ? new Set() : new Set([tab as InvoiceStatus])); setPage(1); }}
          options={(["all", "draft", "approved", "sent", "paid", "overdue", "cancelled"] as const).map((tab) => ({
            value: tab,
            label: tab === "sent" ? "Awaiting payment" : tab === "all" ? "All" : STATUS_LABELS[tab],
            count: tab === "all" ? dateAndSearchFiltered.length : dateAndSearchFiltered.filter((invoice) => invoice.status === tab).length,
          }))}
        />
        <ResultCount count={filtered.length} singular="invoice" />

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
            <EmptyState
              className="border-0 shadow-none"
              icon={<Receipt className="h-5 w-5" />}
              title={!invoices?.length ? "No invoices yet" : debouncedSearch.trim() ? "No invoices match your search" : isFiltered ? "No invoices match these filters" : "No invoices yet"}
              description={!invoices?.length ? "Invoices are created from within a job." : debouncedSearch.trim() ? "Try another search term." : isFiltered ? "Adjust the date or status filters to see more invoices." : "Invoices are created from within a job."}
              action={!!invoices?.length && debouncedSearch.trim()
                ? <Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>
                : undefined}
            />
          ) : (
            <div className="divide-y divide-border/50">
              {pageInvoices.map((inv) => (
                <div key={inv.id} className="flex min-w-0 items-center">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/manage/${inv.project_id}?tab=invoices&invoice=${encodeURIComponent(inv.id)}`)
                  }
                  aria-label={`Open invoice ${inv.invoice_number} for ${inv.projectName}`}
                  className="block min-w-0 flex-1 cursor-pointer text-left transition-colors hover:bg-muted/40 group"
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
                        {formatFullDate(inv.created_at)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        <StatusBadge status={inv.status} size="sm" />
                        <span className="text-xs font-semibold text-muted-foreground">
                          <Money value={inv.total} basis="inc GST" />
                        </span>
                        {inv.due_date && (
                          <span className="text-xs text-muted-foreground">
                            · Due {formatFullDate(inv.due_date)}
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
                        {formatFullDate(inv.created_at)}
                      </p>
                    </div>
                    <span className="min-w-0 break-words [overflow-wrap:anywhere] text-sm text-muted-foreground font-mono">
                      {inv.invoice_number}
                    </span>
                    <StatusBadge status={inv.status} size="sm" className="w-fit" />
                      <span className="text-sm font-semibold text-right tabular-nums">
                       <Money value={inv.total} basis="inc GST" className="justify-end" />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {inv.due_date
                        ? formatFullDate(inv.due_date)
                        : "—"}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
                <Button variant="ghost" size="icon" className="mr-2 shrink-0 text-destructive" aria-label={`Delete invoice ${inv.invoice_number}`}
                  onClick={() => setDeletingInvoice(inv)}><Trash2 /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
        {!isLoading && !isError && (
          <ListPagination page={currentPage} pageSize={10} total={filtered.length} onChange={setPage} />
        )}
      </PageLayout>
      <DeleteResourceDialog target={deletingInvoice ? { kind: 'invoice', id: deletingInvoice.id } : null}
        label={deletingInvoice?.invoice_number ?? ''} onClose={() => setDeletingInvoice(null)} />
    </AppShell>
  );
}
