import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, BadgeDollarSign, Briefcase, CalendarDays, CheckCircle2, CircleDollarSign, FileClock, TrendingUp } from "lucide-react";
import { useScope } from "./ScopeContext";
import { formatMoney, isInReferenceMonth, quoteIncGst, relativeAge } from "./lib/calc";
import { JobCard, Metric, SectionHead, TenantChip } from "./components";

export default function Dashboard() {
  const { jobs, activity, dismissedAttention, setDismissedAttention, toast, openCostModal } = useScope();
  const navigate = useNavigate();
  const activeJobs = useMemo(() => jobs.filter((job) => job.status !== "Completed"), [jobs]);
  const variationPending = jobs.reduce((sum, job) => sum + job.variations.filter((variation) => variation.status === "Pending").length, 0);
  const completedThisMonth = jobs.filter((job) => isInReferenceMonth(job.signedOffAt)).length;
  const unpaid = jobs.reduce((sum, job) => sum + job.invoices.filter((invoice) => invoice.status === "Sent").reduce((invoiceSum, invoice) => invoiceSum + (quoteIncGst(invoice.amountExGst) ?? 0), 0), 0);
  const smith = jobs.find((job) => job.id === "smith-project");
  return <div>
    <div className="ss-eyebrow" style={{ marginBottom: 9 }}>Field overview</div>
    <TenantChip />
    <div className="ss-page-head" style={{ marginTop: 12 }}>
      <div><h1 className="ss-h1">Welcome back, Jaden</h1><p className="ss-subtitle">Here is your daily operational run-down</p></div>
      <span className="ss-avatar" aria-label="Jaden">JP</span>
    </div>
    <div className="ss-actions">
      <button className="ss-btn ss-btn-primary" style={{ flex: 1 }} onClick={() => toast("New job setup is coming soon")}><span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>New Job</button>
      <button className="ss-btn ss-btn-tonal" style={{ flex: 1 }} onClick={() => navigate("/schedule")}><CalendarDays size={14} />Schedule</button>
    </div>
    {!dismissedAttention && smith && smith.costs.length === 0 && <section className="ss-attention">
      <div className="ss-attention-icon"><AlertTriangle size={15} /></div>
      <div className="ss-attention-body">
        <div className="ss-attention-label">Action required</div>
        <div className="ss-job-row"><div className="ss-attention-title">Smith Project · no costs logged</div><span className="ss-small-muted">Today</span></div>
        <div className="ss-attention-copy">Missing operational receipts and material costs.</div>
        <div className="ss-attention-actions"><button className="ss-btn ss-btn-danger ss-btn-small" onClick={() => openCostModal(smith.id)}>Log Costs</button><button className="ss-dismiss" onClick={() => setDismissedAttention(true)}>Dismiss</button></div>
      </div>
    </section>}
    <div className="ss-metrics">
      <Metric label="Active Jobs" value={activeJobs.length} detail={`Live · ${activeJobs.filter((job) => job.scheduledLabel).length} on schedule`} tone="#2563eb" icon={<Briefcase size={12} />} />
      <Metric label="Variations" value={variationPending} detail={variationPending ? "Awaiting review" : "All reviewed"} tone="#f59e0b" icon={<TrendingUp size={12} />} />
      <Metric label="Completed" value={completedThisMonth} detail="Signed off this month" tone="#0284c7" icon={<CheckCircle2 size={12} />} />
      <Metric label="Unpaid" value={formatMoney(unpaid)} detail="inc GST · no overdue balance" tone="#0f172a" icon={<CircleDollarSign size={12} />} />
    </div>
    <SectionHead title={<>Active Jobs <span className="ss-count">{activeJobs.length}</span></>} action={<Link to="/jobs" className="ss-link">View all <span style={{ fontSize: 14 }}>›</span></Link>} />
    {activeJobs.length ? activeJobs.map((job) => <JobCard key={job.id} job={job} />) :
      <div className="ss-empty"><div className="ss-empty-title">No active jobs on site</div><div className="ss-empty-copy">Your active projects will appear here.</div></div>}
    <SectionHead title="Recent Activity" action={<button className="ss-link" onClick={() => toast("Activity feed settings are not available in this prototype")}>Feed settings</button>} />
    {activity.map((entry) => <article className="ss-card ss-feed-item" key={entry.id}>
      <div className={`ss-feed-icon${entry.kind === "variation" ? " warm" : ""}`}>{entry.kind === "invoice" ? <BadgeDollarSign size={15} /> : <CheckCircle2 size={15} />}</div>
      <div style={{ minWidth: 0, flex: 1 }}><div className="ss-feed-title">{entry.title}</div><div className="ss-feed-detail">{entry.detail}</div></div><span className="ss-feed-age">{relativeAge(entry.occurredAt)}</span>
    </article>)}
    <div className="ss-overline" style={{ textAlign: "center", paddingBottom: 12 }}><FileClock size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />Sample data · changes stay in this session</div>
  </div>;
}
