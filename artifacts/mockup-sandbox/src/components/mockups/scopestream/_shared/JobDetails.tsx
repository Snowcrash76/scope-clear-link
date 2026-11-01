import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  BadgeCheck, CalendarDays, ChevronRight, Clock3, FileText, Flag, ImagePlus,
  Mail, MapPin, Phone, Plus, Receipt, Send, ShieldCheck, Upload, Users,
} from "lucide-react";
import { useScope } from "./ScopeContext";
import { BackLink, EmptyState, Metric, Modal, ProgressBar, SectionHead, StatusBadge, TenantChip } from "./components";
import { costPercentOfBudget, costsToDate, depositAmount, formatKnownMoney, formatMoney, quoteIncGst } from "./lib/calc";
import type { Invoice } from "./data";

const sections = [
  { id: "overview", label: "Overview" }, { id: "quote", label: "Quote" }, { id: "variations", label: "Variations" },
  { id: "stages", label: "Stages" }, { id: "invoices", label: "Invoices" }, { id: "team", label: "Team" }, { id: "documents", label: "Documents" },
];
export default function JobDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { jobs, setJobs, toast, notes, setNotes, uploadedFiles, setUploadedFiles, setModal } = useScope();
  const job = jobs.find((item) => item.id === id);
  const section = location.hash.replace("#", "") || "overview";
  const [noteDraft, setNoteDraft] = useState("");
  const [invoiceToView, setInvoiceToView] = useState<Invoice | null>(null);
  const [teamModal, setTeamModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!location.hash) navigate(`${location.pathname}#overview`, { replace: true });
  }, [location.hash, location.pathname, navigate]);
  useEffect(() => {
    if (section === "invoices") document.getElementById("ss-invoices")?.scrollIntoView({ block: "start" });
    else if (section === "team") document.getElementById("ss-team")?.scrollIntoView({ block: "start" });
    else if (section === "documents") document.getElementById("ss-documents")?.scrollIntoView({ block: "start" });
  }, [section]);
  useEffect(() => { setModal(teamModal ? <TeamDialog jobId={id ?? ""} close={() => setTeamModal(false)} /> : invoiceToView ? <InvoiceDialog invoice={invoiceToView} close={() => setInvoiceToView(null)} /> : null); }, [teamModal, invoiceToView, id, setModal]);

  if (!job) return <div><BackLink /><EmptyState title="Job not found" copy="This sample job is not available." action={<button className="ss-btn ss-btn-tonal ss-btn-small" onClick={() => navigate("/jobs")}>Back to jobs</button>} /></div>;
  const cost = costsToDate(job);
  const completedStages = job.stages.filter((stage) => stage.status === "complete").length;
  const sentInvoices = job.invoices.filter((invoice) => invoice.status === "Sent" || invoice.status === "Paid");
  const hasUnknownInvoiceAmount = sentInvoices.some((invoice) => invoice.amountExGst === null);
  const billedExGst = sentInvoices.reduce((sum, invoice) => sum + (invoice.amountExGst ?? 0), 0);
  const draftCount = job.invoices.filter((invoice) => invoice.status === "Draft").length;
  const quoteTotalIncGst = quoteIncGst(job.quoteExGst);
  const remainingIncGst = quoteTotalIncGst === null || hasUnknownInvoiceAmount ? null : Math.max(0, quoteTotalIncGst - (quoteIncGst(billedExGst) ?? 0));
  const currentNote = () => {
    if (!noteDraft.trim()) return;
    setNotes((current) => [`${noteDraft.trim()} · just now`, ...current]);
    setNoteDraft("");
    toast("Quick note added");
  };
  const createInvoice = () => {
    if (job.quoteExGst === null) {
      toast("Invoice amount is not supplied for this sample job");
      return;
    }
    const existing = job.invoices.find((invoice) => invoice.title === "Stage 1: Deposit");
    if (existing) {
      setInvoiceToView(existing);
      toast("Existing deposit invoice opened");
      return;
    }
    const created: Invoice = { id: `draft-${Date.now()}`, amountExGst: depositAmount(job.quoteExGst), status: "Draft", title: "Stage 1: Deposit", createdAt: "Just now" };
    setJobs((current) => current.map((item) => item.id === job.id ? { ...item, invoices: [...item.invoices, created] } : item));
    setInvoiceToView(created);
    toast("Deposit invoice draft created");
  };
  const uploadFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) {
      setUploadedFiles((current) => [...current, ...files.map((file) => file.name)]);
      toast(`${files.length} file${files.length === 1 ? "" : "s"} added to this prototype`);
    }
    event.target.value = "";
  };
  const setSection = (tab: string) => navigate(`${location.pathname}#${tab}`);
  return <div>
    <div className="ss-job-row"><Link to="/jobs" className="ss-back"><span style={{ fontSize: 16 }}>‹</span> Jobs</Link><div className="ss-tenant" style={{ fontSize: 8 }}>FIXT Property Services</div></div>
    <div className="ss-detail-head">
      <div className="ss-detail-title-row"><div><div className="ss-eyebrow">Job Details</div><h1 className="ss-detail-job-title">{job.name}</h1></div><StatusBadge status={job.status} /></div>
      {job.scheduledLabel && <div className="ss-scheduled"><CalendarDays size={11} />Scheduled: {job.scheduledLabel} {job.jobNumber && <><span>·</span> Job #{job.jobNumber}</>}</div>}
    </div>
    <section className="ss-card ss-client-card">
      <div className="ss-client-head"><div className="ss-client-initials">{job.client.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><div className="ss-client-name">{job.client.name}</div><div className="ss-client-type">{job.client.projectType}</div></div><ShieldCheck size={15} className="ss-verified" aria-label="Client details verified" /></div>
      {job.client.email && <div className="ss-client-meta"><Mail size={12} /><span>{job.client.email}</span></div>}
      {job.client.address && <div className="ss-client-meta"><MapPin size={12} /><span>{job.client.address}</span><button className="ss-icon-button" style={{ marginLeft: "auto", color: "#2454b8" }} aria-label="Map preview" onClick={() => toast("Map preview is not connected in this prototype")}><MapPin size={14} /></button></div>}
      <div className="ss-client-buttons">
        <a className="ss-btn ss-btn-tonal" href={`tel:${job.client.phone.replaceAll(" ", "")}`}><Phone size={12} />Call</a>
        <a className="ss-btn ss-btn-tonal" href={`mailto:${job.client.email}`}><Mail size={12} />Email</a>
        <button className="ss-btn ss-btn-primary" onClick={() => toast("Client portal link copied · prototype only")}><Send size={12} />Client Portal</button>
      </div>
    </section>
    <nav className="ss-detail-tabs" aria-label="Job sections">{sections.map((tab) => <button key={tab.id} role="tab" aria-selected={section === tab.id} className={`ss-detail-tab${section === tab.id ? " active" : ""}`} onClick={() => setSection(tab.id)}>{tab.label}</button>)}</nav>
    {section === "overview" ? <div className="ss-detail-content">
      <div className="ss-metrics ss-detail-metrics">
        <Metric label="Quote total" value={formatKnownMoney(quoteIncGst(job.quoteExGst))} detail="Inc. GST" tone="#2563eb" icon={<Receipt size={12} />} />
        <Metric label="Costs so far" value={formatMoney(cost)} detail={`${(costPercentOfBudget(job) * 100).toFixed(1)}% of budget`} tone="#0284c7" icon={<BadgeCheck size={12} />} />
        <Metric label="Variations" value={job.variations.filter((variation) => variation.status === "Pending").length} detail="needing action" tone="#f59e0b" icon={<FileText size={12} />} />
        <Metric label="Stages" value={`${completedStages} / ${job.stages.length}`} detail={`${job.stages[0]?.name ?? "No stages"} ${completedStages ? "complete" : "pending"}`} tone="#475569" icon={<Flag size={12} />} />
      </div>
      <section className="ss-card ss-block">
        <div className="ss-job-row"><div className="ss-block-title"><FileText size={14} color="#2553ad" />{job.specName}</div><span className="ss-badge">{job.specVersion} {job.specStatus}</span></div>
        <div className="ss-file-row"><div className="ss-pdf-icon"><FileText size={17} /></div><div className="ss-file-info"><div className="ss-file-name">{job.specName}.pdf</div><div className="ss-file-sub">PDF document · Updated {job.updated}</div></div><button className="ss-btn ss-btn-white ss-btn-small" onClick={() => toast("Document preview is not available in this prototype")}>View</button></div>
      </section>
      <section className="ss-card ss-stage">
        <div className="ss-stage-header"><div className="ss-empty-icon" style={{ margin: 0, width: 31, height: 31 }}><CircleDollarIcon /></div><div className="ss-stage-info"><div className="ss-block-title">Stages &amp; Milestones</div><div className="ss-small-muted">Stage 1: Deposit</div></div><div className="ss-stage-amount">{formatKnownMoney(depositAmount(job.quoteExGst))}<div className="ss-amount-sub">ex GST · 5% deposit</div></div></div>
        <div className="ss-stage-status"><Clock3 size={13} />{job.stages[0]?.status === "complete" ? "Deposit stage complete" : "Awaiting initial deposit invoice release"}</div>
        <button className="ss-btn ss-btn-primary ss-btn-full" onClick={createInvoice} disabled={job.quoteExGst === null}>{draftCount ? <><Receipt size={13} />View Invoice</> : <><Receipt size={13} />Generate Invoice</>}</button>
      </section>
      <section className="ss-card ss-block" id="ss-team">
        <div className="ss-job-row"><div><div className="ss-block-title"><Users size={14} color="#2553ad" />Team &amp; Schedule</div><div className="ss-small-muted">{job.hoursLogged}h 00m Logged</div></div><button className="ss-btn ss-btn-tonal ss-btn-small" onClick={() => setTeamModal(true)}>Assign Team</button></div>
        {job.team.filter((member) => member.assigned).map((member) => <div className="ss-team-row" key={member.id}><div className="ss-team-initials">{member.name.split(" ").map((part) => part[0]).join("")}</div><div className="ss-team-info"><div className="ss-team-name">{member.name}</div><div className="ss-team-role">{member.role}</div></div><span className="ss-badge">On site</span></div>)}
        {!job.team.some((member) => member.assigned) && <div className="ss-small-muted" style={{ padding: "12px 0 2px" }}>No team members assigned yet.</div>}
      </section>
      <section className="ss-card ss-block" id="ss-invoices">
        <div className="ss-job-row"><div className="ss-block-title"><Receipt size={14} color="#2553ad" />Invoices &amp; Billing</div><span className="ss-small-muted">{sentInvoices.length} of 3 Sent{draftCount ? ` · ${draftCount} draft` : ""}</span></div>
        <div className="ss-billing-grid"><div className="ss-billing-tile"><div className="ss-label">Invoiced (ex GST)</div><div className="ss-billing-value">{hasUnknownInvoiceAmount ? "—" : formatMoney(billedExGst)}</div></div><div className="ss-billing-tile"><div className="ss-label">Remaining (inc GST)</div><div className="ss-billing-value">{formatKnownMoney(remainingIncGst)}</div></div></div>
        {job.invoices.length ? <div style={{ display: "grid", gap: 6, marginTop: 10 }}>{job.invoices.map((invoice) => <button key={invoice.id} className="ss-file-row" style={{ border: 0, textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => setInvoiceToView(invoice)}><Receipt size={15} color="#2553ad" /><span className="ss-file-info"><span className="ss-file-name">{invoice.title}</span><span className="ss-file-sub">{formatKnownMoney(invoice.amountExGst)} ex GST</span></span><StatusBadge status={invoice.status} /><ChevronRight size={14} /></button>)}</div> :
          <div style={{ margin: "10px 0" }}><EmptyState title="No invoices yet" copy="Invoices you create for this job will appear here." /></div>}
        <button className="ss-btn ss-btn-primary ss-btn-full" style={{ marginTop: 8 }} onClick={createInvoice}><Plus size={14} />Create Invoice</button>
      </section>
      <section className="ss-card ss-block">
        <div className="ss-job-row"><div className="ss-block-title"><ImagePlus size={14} color="#2553ad" />Site Visual Records</div><span className="ss-badge">2 active views</span></div>
        <div className="ss-photo-grid"><div className="ss-photo"><span className="ss-photo-caption">Pre-Start Site</span></div><div className="ss-photo"><span className="ss-photo-caption">Material Pack</span></div></div>
        <div id="ss-documents" className="ss-file-row" style={{ marginTop: 0 }}><div className="ss-pdf-icon"><FileText size={15} /></div><div className="ss-file-info"><div className="ss-file-name">Documents &amp; Photos</div><div className="ss-file-sub">{uploadedFiles.length} additional files uploaded</div></div><input ref={fileRef} type="file" multiple hidden onChange={uploadFiles} /><button className="ss-btn ss-btn-primary ss-btn-small" onClick={() => fileRef.current?.click()}><Upload size={12} />Upload</button></div>
        {uploadedFiles.map((file, index) => <div className="ss-small-muted" key={`${file}-${index}`} style={{ margin: "6px 4px" }}><FileText size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />{file}</div>)}
        {notes.length > 0 && <><div className="ss-divider" /><div className="ss-label">Quick notes</div><div className="ss-note-list">{notes.map((note, index) => <div className="ss-note" key={`${note}-${index}`}>{note}</div>)}</div></>}
      </section>
      <div className="ss-overline" style={{ textAlign: "center" }}>Sample job data · updates are temporary</div>
    </div> : <div className="ss-detail-content"><EmptyState title="Under construction" copy={`${sections.find((item) => item.id === section)?.label ?? "This section"} will be available in a future ScopeStream release.`} action={<button className="ss-btn ss-btn-tonal ss-btn-small" onClick={() => setSection("overview")}>Back to overview</button>} /></div>}
    <div className="ss-note-bar"><input ref={noteRef} className="ss-input" aria-label="Quick note" placeholder="Add quick note or update for Danny..." value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") currentNote(); }} /><button className="ss-note-send" aria-label="Add quick note" onClick={currentNote}><Send size={15} /></button></div>
  </div>;
}

function CircleDollarIcon() {
  return <span style={{ fontSize: 15, fontWeight: 800 }}>$</span>;
}
function TeamDialog({ jobId, close }: { jobId: string; close: () => void }) {
  const { jobs, setJobs, toast } = useScope();
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return null;
  const members = [...job.team, ...(!job.team.some((member) => member.id === "danny") ? [{ id: "danny", name: "Danny Basaran", role: "Leading Hand", assigned: false }] : [])];
  const update = (memberId: string, assigned: boolean) => setJobs((current) => current.map((item) => item.id === jobId ? { ...item, team: members.map((member) => member.id === memberId ? { ...member, assigned } : member) } : item));
  return <Modal title="Assign team" onClose={close}><p className="ss-subtitle" style={{ marginTop: -4 }}>Choose who is working on {job.name}.</p>{members.map((member) => <label className="ss-check-row" key={member.id}><input type="checkbox" checked={member.assigned} onChange={(event) => update(member.id, event.target.checked)} /><div className="ss-team-info"><div className="ss-team-name">{member.name}</div><div className="ss-team-role">{member.role}</div></div></label>)}<div className="ss-modal-actions"><button className="ss-btn ss-btn-primary" onClick={() => { close(); toast("Team assignments updated in this prototype"); }}>Done</button></div></Modal>;
}
function InvoiceDialog({ invoice, close }: { invoice: Invoice; close: () => void }) {
  const { toast } = useScope();
  return <Modal title="Invoice draft" onClose={close}>
    <div style={{ padding: "8px 10px 12px", background: "#f4f7fc", borderRadius: 13, margin: "5px 0 12px" }}>
      <div className="ss-job-row"><div><div className="ss-label">Invoice status</div><div style={{ marginTop: 6 }}><StatusBadge status={invoice.status} /></div></div><FileText size={22} color="#2563eb" /></div>
      <div className="ss-divider" /><div className="ss-label">{invoice.title}</div><div className="ss-value">{formatKnownMoney(invoice.amountExGst)} <span className="ss-amount-sub">ex GST</span></div><div className="ss-small-muted">Total inc GST · {formatKnownMoney(quoteIncGst(invoice.amountExGst))}</div>
    </div>
    <p className="ss-small-muted" style={{ lineHeight: 1.5 }}>This invoice is a local prototype draft. No email is sent and no payment is collected.</p>
    <div className="ss-modal-actions"><button className="ss-btn ss-btn-white" onClick={close}>Close</button><button className="ss-btn ss-btn-primary" onClick={() => { close(); toast("Invoice draft ready · no email sent"); }}>Done</button></div>
  </Modal>;
}
