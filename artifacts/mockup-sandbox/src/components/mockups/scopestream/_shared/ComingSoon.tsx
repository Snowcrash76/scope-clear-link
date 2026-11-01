import { CalendarDays, ChartNoAxesCombined, Clock3, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useScope } from "./ScopeContext";
import { TenantChip } from "./components";

export default function ComingSoon({ financial = false }: { financial?: boolean }) {
  const { toast } = useScope();
  const Icon = financial ? ChartNoAxesCombined : CalendarDays;
  return <div className="ss-coming">
    <TenantChip />
    <div className="ss-coming-art" style={{ marginTop: 24 }}><Icon size={31} strokeWidth={1.7} /></div>
    <div className="ss-eyebrow">FIXT PROPERTY SERVICES</div>
    <h1>{financial ? "Financials" : "Schedule"}</h1>
    <p>{financial ? "Invoice tracking and a clear view of job costs are on the way." : "Your upcoming site visits and job milestones will live here."}</p>
    <span className="ss-status ss-status-quoted"><Clock3 size={11} style={{ marginRight: 4 }} />Coming soon</span>
    <div className="ss-card" style={{ width: "100%", padding: 14, textAlign: "left", marginTop: 24 }}>
      <div className="ss-block-title"><Icon size={15} color="#2454b8" />{financial ? "Financial overview" : "Your work calendar"}</div>
      <div className="ss-small-muted" style={{ marginTop: 7, lineHeight: 1.55 }}>{financial ? "Draft invoices, payments, and ex-GST job costs will be collected in one place." : "See scheduled jobs, assigned people, and the next milestone at a glance."}</div>
    </div>
    <button className="ss-btn ss-btn-tonal" style={{ marginTop: 18 }} onClick={() => toast("This section is a coming-soon prototype view")}><LayoutDashboard size={14} />Explore later</button>
    <Link className="ss-link" style={{ marginTop: 6 }} to="/">Return to dashboard</Link>
  </div>;
}
