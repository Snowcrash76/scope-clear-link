import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Archive, ArrowLeft, ArrowRight, Bell, Briefcase, CalendarDays, ChevronRight, ClipboardList,
  LayoutDashboard, MoreHorizontal, Receipt, Search, UserRound, X,
} from "lucide-react";
import type { Job, JobStatus } from "./data";
import { useScope } from "./ScopeContext";
import { costsToDate, estimatedMargin, formatKnownMoney, marginAmount } from "./lib/calc";

export function BrandMark() {
  return <div className="ss-brand"><div className="ss-mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17.5 6.7c-1.3-1.2-3.1-1.8-5.5-1.8-3.7 0-6.1 1.8-6.1 4.7 0 2.5 1.8 3.6 5.8 4.3 3 .5 3.9 1 3.9 2.1 0 1.2-1.2 1.9-3.2 1.9-2.1 0-4.1-.8-5.7-2.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></div><div><div className="ss-brand-name">ScopeStream</div><div className="ss-brand-section">FIELD OVERVIEW</div></div></div>;
}
export function Header({ section }: { section: string }) {
  const { toast } = useScope();
  const navigate = useNavigate();
  return <header className="ss-header">
    <div className="ss-brand"><div className="ss-mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17.5 6.7c-1.3-1.2-3.1-1.8-5.5-1.8-3.7 0-6.1 1.8-6.1 4.7 0 2.5 1.8 3.6 5.8 4.3 3 .5 3.9 1 3.9 2.1 0 1.2-1.2 1.9-3.2 1.9-2.1 0-4.1-.8-5.7-2.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></div><div><div className="ss-brand-name">ScopeStream</div><div className="ss-brand-section">{section.toUpperCase()}</div></div></div>
    <div className="ss-head-actions">
      <button className="ss-icon-button" aria-label="Search jobs" onClick={() => navigate("/jobs")}><Search size={17} /></button>
      <button className="ss-icon-button" aria-label="Notifications" onClick={() => toast("You're all caught up")}><Bell size={17} /><span className="ss-dot" /></button>
      <button className="ss-icon-button" aria-label="Profile" onClick={() => toast("Jaden · sample profile")}><span className="ss-avatar">JP</span></button>
    </div>
  </header>;
}
export function BottomTabs() {
  const location = useLocation();
  const { jobs } = useScope();
  const activeCount = jobs.filter((job) => job.status === "In Progress").length;
  const tabs = [
    { label: "Dashboard", to: "/", icon: LayoutDashboard, active: location.pathname === "/" },
    { label: "Jobs", to: "/jobs", icon: Briefcase, active: location.pathname.startsWith("/jobs"), count: activeCount },
    { label: "Schedule", to: "/schedule", icon: CalendarDays, active: location.pathname === "/schedule" },
    { label: "Financials", to: "/financials", icon: Receipt, active: location.pathname === "/financials" },
  ];
  return <nav className="ss-bottom" aria-label="Main navigation">{tabs.map(({ label, to, icon: Icon, active, count }) =>
    <Link key={label} to={to} className={`ss-tab${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      {count ? <span className="ss-tab-count">{count}</span> : null}<Icon size={18} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span>
    </Link>)}</nav>;
}
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const section = location.pathname.startsWith("/jobs") ? (location.pathname.includes("/", 1) ? "Jobs" : "Jobs") : location.pathname === "/schedule" ? "Schedule" : location.pathname === "/financials" ? "Financials" : "Dashboard";
  return <div className="ss-frame"><Header section={section} /><main className="ss-main" key={location.pathname}>{children}</main><BottomTabs /></div>;
}
export function TenantChip() {
  return <span className="ss-tenant"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563eb" }} />FIXT Property Services</span>;
}
export function StatusBadge({ status }: { status: JobStatus | string }) {
  let className = "ss-status";
  if (status === "In Progress") className += " ss-status-progress";
  else if (status === "Completed" || status === "Paid" || status === "Approved") className += " ss-status-complete";
  else if (status === "Quoted" || status === "Lead" || status === "Draft") className += " ss-status-quoted";
  else className += " ss-status-attention";
  return <span className={className}>{status}</span>;
}
export function Metric({ label, value, detail, tone = "#2563eb", icon }: { label: string; value: string | number; detail: string; tone?: string; icon: ReactNode }) {
  return <div className="ss-metric" style={{ "--metric-color": tone } as React.CSSProperties}><div className="ss-metric-top"><span className="ss-metric-label">{label}</span><span className="ss-metric-symbol">{icon}</span></div><div className="ss-metric-value">{value}</div><div className="ss-metric-detail">{detail}</div></div>;
}
export function SectionHead({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return <div className="ss-section-head"><h2 className="ss-section-title">{title}</h2>{action}</div>;
}
export function ProgressBar({ value, label, detail }: { value: number; label: string; detail: string }) {
  return <><div className="ss-progress-label"><span>{label}</span><span>{detail}</span></div><div className="ss-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></div></>;
}
export function JobCard({ job, pipeline = false }: { job: Job; pipeline?: boolean }) {
  const { toast, setJobs } = useScope();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const margin = estimatedMargin(job);
  const archive = () => {
    setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: "Completed" } : item));
    setMenuOpen(false);
    toast("Job moved to Archive");
  };
  return <article className="ss-card ss-job-card">
    <div className="ss-job-row">
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><StatusBadge status={job.status} /><span className="ss-ref">{job.ref}</span></div>
      {pipeline ? <div className="ss-menu-wrap"><button className="ss-icon-button" aria-label={`More actions for ${job.name}`} onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={18} /></button>{menuOpen && <div className="ss-menu"><button onClick={() => navigate(`/jobs/${job.id}`)}><ChevronRight size={14} />Open details</button>{job.status !== "Completed" && <button onClick={archive}><Archive size={14} />Archive</button>}</div>}</div> : null}
    </div>
    <h3 className="ss-job-title" style={{ marginTop: 9 }}>{job.name}</h3>
    <div className="ss-client-line"><UserRound size={13} /><span>{job.client.name}</span>{!pipeline && job.ref && <span style={{ marginLeft: "auto" }} className="ss-ref">Ref: {job.ref}</span>}</div>
    {pipeline ? <div className="ss-quote-panel"><div><div className="ss-label">Quote value (ex GST)</div><div className="ss-value">{formatKnownMoney(job.quoteExGst)}</div><div className="ss-small-muted">{job.validTo ? `Valid to ${job.validTo}` : "Quote amount not supplied"}</div></div><div style={{ textAlign: "right" }}><div className="ss-label">Est. profit (ex GST)</div><div className="ss-value">{formatKnownMoney(marginAmount(job))}</div><div className="ss-small-muted">{margin === null ? "indicative · pending data" : <><span className="ss-badge">{(margin * 100).toFixed(1)}%</span> indicative</>}</div></div></div> :
      <div className="ss-quote-panel"><div><div className="ss-label">Quote value</div><div className="ss-value">{formatKnownMoney(job.quoteExGst)} <span className="ss-amount-sub">(Ex GST)</span></div></div><div style={{ textAlign: "right" }}><div className="ss-label">Target completion</div><div className="ss-value">{job.targetCompletion || "—"}</div></div></div>}
    <ProgressBar value={job.stages.length ? job.stages.filter((stage) => stage.status === "complete").length / job.stages.length * 100 : 0} label={`Stage: ${job.stages[0]?.name ?? "Not set"}`} detail={`${job.stages.length ? Math.round(job.stages.filter((stage) => stage.status === "complete").length / job.stages.length * 100) : 0}% of ${job.stages.length} stages`} />
    {pipeline ? <div className="ss-job-row" style={{ marginTop: 7 }}><span className="ss-small-muted">{job.status === "In Progress" ? "In progress" : job.status} · updated {job.updated}</span><Link className="ss-link" to={`/jobs/${job.id}`}>Open details <ChevronRight size={13} /></Link></div> :
      <div className="ss-job-buttons"><button className="ss-btn ss-btn-white" onClick={() => navigate(`/jobs/${job.id}`)}>View Job</button><button className="ss-btn ss-btn-primary" onClick={() => toast("Link copied · prototype only")}><ArrowRight size={14} />Send to Client</button></div>}
  </article>;
}
export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="ss-empty"><div className="ss-empty-icon"><ClipboardList size={20} /></div><div className="ss-empty-title">{title}</div><div className="ss-empty-copy">{copy}</div>{action}</div>;
}
export function BackLink({ to = "/jobs", children = "Jobs" }: { to?: string; children?: ReactNode }) {
  return <Link className="ss-back" to={to}><ArrowLeft size={14} />{children}</Link>;
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, []);
  return <div className="ss-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="ss-modal"><div className="ss-modal-top"><div className="ss-modal-title">{title}</div><button ref={closeRef} className="ss-close" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></div>{children}</section></div>;
}
