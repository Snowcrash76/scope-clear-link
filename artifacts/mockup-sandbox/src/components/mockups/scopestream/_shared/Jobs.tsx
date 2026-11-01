import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useScope } from "./ScopeContext";
import { JobCard, Metric, TenantChip, EmptyState } from "./components";
import { formatMoney } from "./lib/calc";

type Filter = "Active" | "Quoted" | "Approved" | "In Progress" | "Archive";
type SortKey = "Updated" | "Quote value" | "Name";
export default function Jobs() {
  const { jobs, toast, pipelineFilter: filter, setPipelineFilter: setFilter, pipelineSearch: query, setPipelineSearch: setQuery, pipelineSort: sort, setPipelineSort: setSort } = useScope();
  const [sortOpen, setSortOpen] = useState(false);
  const quoted = jobs.filter((job) => job.status === "Quoted");
  const categories: Filter[] = ["Active", "Quoted", "Approved", "In Progress", "Archive"];
  const countFor = (category: Filter) => category === "Active" ? jobs.filter((job) => job.status !== "Completed").length :
    category === "Archive" ? jobs.filter((job) => job.status === "Completed").length : jobs.filter((job) => job.status === category).length;
  const hasPendingQuoteDrafts = jobs.some((job) => job.status === "Quoted" && (job.quoteStatus === "draft" || job.quoteStatus === "revised"));
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matches = jobs.filter((job) => {
      const categoryMatch = filter === "Active" ? job.status !== "Completed" :
        filter === "Archive" ? job.status === "Completed" : job.status === filter;
      const searchMatch = !needle || [job.name, job.client.name, job.ref].some((value) => value.toLocaleLowerCase().includes(needle));
      return categoryMatch && searchMatch;
    });
    return [...matches].sort((a, b) => sort === "Name" ? a.name.localeCompare(b.name) : sort === "Quote value" ? (b.quoteExGst ?? 0) - (a.quoteExGst ?? 0) : b.updated.localeCompare(a.updated));
  }, [jobs, filter, query, sort]);
  return <div>
    <TenantChip />
    <div className="ss-metrics" style={{ marginTop: 14 }}>
      <Metric label="Open Quote Value" value={formatMoney(quoted.reduce((sum, job) => sum + (job.quoteExGst ?? 0), 0))} detail="Ex. GST" tone="#2563eb" icon={<Search size={12} />} />
      <Metric label="Quotes Awaiting Response" value={quoted.filter((job) => job.quoteStatus === "sent").length} detail="Sent quote · client decision pending" tone="#f59e0b" icon={<ChevronDown size={12} />} />
    </div>
    <div className="ss-page-head" style={{ alignItems: "center", marginTop: 14 }}>
      <div><h1 className="ss-h1">Job Pipeline</h1><p className="ss-subtitle">{jobs.filter((job) => job.status === "In Progress").length} active project(s) on site</p></div>
      <button className="ss-btn ss-btn-primary ss-btn-small" onClick={() => toast("New job setup is coming soon")}>New Job</button>
    </div>
    <div className="ss-search-row">
      <label className="ss-search"><Search size={15} /><input className="ss-input" aria-label="Search jobs" placeholder="Search jobs, clients or reference" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="ss-menu-wrap">
        <button className="ss-btn ss-btn-white" style={{ width: 44, padding: 0 }} aria-label="Sort jobs" aria-expanded={sortOpen} onClick={() => setSortOpen(!sortOpen)}><SlidersHorizontal size={16} /></button>
        {sortOpen && <div className="ss-sort-sheet" role="menu">{(["Updated", "Quote value", "Name"] as SortKey[]).map((option) => <button role="menuitemradio" aria-checked={sort === option} className="ss-sort-option" key={option} onClick={() => { setSort(option); setSortOpen(false); }}><span>{option}</span>{sort === option && <Check size={14} color="#2563eb" />}</button>)}</div>}
      </div>
    </div>
    <div className="ss-pills" role="tablist" aria-label="Filter jobs">{categories.map((category) => <button key={category} role="tab" aria-selected={filter === category} className={`ss-pill${filter === category ? " active" : ""}`} onClick={() => setFilter(category)}>{category} <span style={{ opacity: .72 }}>{countFor(category)}</span></button>)}</div>
    {filtered.length ? filtered.map((job) => <JobCard key={job.id} job={job} pipeline />) :
      filter === "Quoted" && !query.trim()
        ? <EmptyState title="No quotes yet" copy="Tap New Job to start one." />
        : <EmptyState title="No jobs match your search" copy="Try another search or clear your filters to see more jobs." action={<button className="ss-btn ss-btn-tonal ss-btn-small" onClick={() => { setQuery(""); setFilter("Active"); }}>Clear filters</button>} />}
    {!hasPendingQuoteDrafts && <div className="ss-empty" style={{ marginTop: 11, padding: 15 }}><div className="ss-empty-title">No pending quote drafts</div><div className="ss-empty-copy">Draft or revised quotes on quoted jobs will appear here when they need sending.</div></div>}
    <div className="ss-overline" style={{ textAlign: "center", padding: "12px 0" }}>Sample pipeline · in-memory prototype</div>
  </div>;
}
