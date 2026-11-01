import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { Activity, CostEntry, Job } from "./data";
import { initialActivity, seedJobs } from "./data";

type ScopeState = {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  activity: Activity[];
  setActivity: React.Dispatch<React.SetStateAction<Activity[]>>;
  dismissedAttention: boolean;
  setDismissedAttention: (value: boolean) => void;
  notes: string[];
  setNotes: React.Dispatch<React.SetStateAction<string[]>>;
  uploadedFiles: string[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  toast: (message: string) => void;
  openCostModal: (jobId: string) => void;
  costModalJob: string | null;
  setCostModalJob: (id: string | null) => void;
  modal: ReactNode;
  setModal: (node: ReactNode) => void;
  pipelineSearch: string;
  setPipelineSearch: (value: string) => void;
  pipelineFilter: "Active" | "Lead" | "Quoted" | "Approved" | "In Progress" | "Archive";
  setPipelineFilter: (value: "Active" | "Lead" | "Quoted" | "Approved" | "In Progress" | "Archive") => void;
  pipelineSort: "Updated" | "Quote value" | "Name";
  setPipelineSort: (value: "Updated" | "Quote value" | "Name") => void;
};
const ScopeContext = createContext<ScopeState | null>(null);
const emptyEntries: string[] = [];
export const useScope = () => {
  const context = useContext(ScopeContext);
  if (!context) throw new Error("ScopeStream provider missing");
  return context;
};

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(() => seedJobs.map((job) => ({ ...job, costs: [...job.costs], invoices: [...job.invoices], variations: [...job.variations], stages: [...job.stages], team: [...job.team] })));
  const [activity, setActivity] = useState<Activity[]>(initialActivity);
  const [dismissedAttention, setDismissedAttention] = useState(false);
  const [notesByJob, setNotesByJob] = useState<Record<string, string[]>>({});
  const [filesByJob, setFilesByJob] = useState<Record<string, string[]>>({});
  const [costModalJob, setCostModalJob] = useState<string | null>(null);
  const [modal, setModal] = useState<ReactNode>(null);
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState<ScopeState["pipelineFilter"]>("Active");
  const [pipelineSort, setPipelineSort] = useState<ScopeState["pipelineSort"]>("Updated");
  const [toastText, setToastText] = useState("");
  const [toastShown, setToastShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const location = useLocation();
  const jobKey = location.pathname.startsWith("/jobs/") ? location.pathname.split("/")[2] : "";
  const notes = notesByJob[jobKey] ?? emptyEntries;
  const uploadedFiles = filesByJob[jobKey] ?? emptyEntries;
  const setNotes: ScopeState["setNotes"] = (update) => setNotesByJob((current) => ({
    ...current,
    [jobKey]: typeof update === "function" ? update(current[jobKey] ?? []) : update,
  }));
  const setUploadedFiles: ScopeState["setUploadedFiles"] = (update) => setFilesByJob((current) => ({
    ...current,
    [jobKey]: typeof update === "function" ? update(current[jobKey] ?? []) : update,
  }));

  const toast = (message: string) => {
    setToastText(message);
    setToastShown(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastShown(false), 2400);
  };
  const openCostModal = (jobId: string) => setCostModalJob(jobId);
  const value = useMemo<ScopeState>(() => ({
    jobs, setJobs, activity, setActivity, dismissedAttention, setDismissedAttention,
    notes, setNotes, uploadedFiles, setUploadedFiles, toast, openCostModal,
    costModalJob, setCostModalJob, modal, setModal,
    pipelineSearch, setPipelineSearch, pipelineFilter, setPipelineFilter, pipelineSort, setPipelineSort,
  }), [jobs, activity, dismissedAttention, notes, uploadedFiles, jobKey, costModalJob, modal, pipelineSearch, pipelineFilter, pipelineSort]);

  useEffect(() => {
    setModal(null);
  }, [location.pathname]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <ScopeContext.Provider value={value}>
      {children}
      {modal}
      {costModalJob && <CostModal jobId={costModalJob} />}
      <div aria-live="polite" className={`ss-toast${toastShown ? " show" : ""}`}>{toastText}</div>
    </ScopeContext.Provider>
  );
}

function CostModal({ jobId }: { jobId: string }) {
  const { jobs, setJobs, setCostModalJob, toast } = useScope();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const job = jobs.find((item) => item.id === jobId);
  useEffect(() => { amountRef.current?.focus(); }, []);
  if (!job) return null;
  const save = () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0 || !description.trim()) {
      toast("Enter a valid amount and description");
      return;
    }
    const entry: CostEntry = { id: `cost-${Date.now()}`, amount: parsed, description: description.trim(), createdAt: "Just now" };
    setJobs((current) => current.map((item) => item.id === jobId ? { ...item, costs: [...item.costs, entry] } : item));
    setCostModalJob(null);
    toast("Cost added to this prototype job");
  };
  return (
    <div className="ss-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCostModalJob(null); }}>
      <section className="ss-modal" role="dialog" aria-modal="true" aria-labelledby="cost-modal-title">
        <div className="ss-modal-top"><div className="ss-modal-title" id="cost-modal-title">Log costs</div><button className="ss-close" aria-label="Close" onClick={() => setCostModalJob(null)}>×</button></div>
        <p className="ss-subtitle" style={{ marginTop: -5 }}>{job.name} · amounts entered ex GST</p>
        <div className="ss-field"><label htmlFor="cost-amount">Amount (ex GST)</label><input ref={amountRef} className="ss-input" id="cost-amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
        <div className="ss-field"><label htmlFor="cost-description">Description</label><input className="ss-input" id="cost-description" placeholder="e.g. Site materials" value={description} onChange={(event) => setDescription(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); }} /></div>
        <div className="ss-modal-actions"><button className="ss-btn ss-btn-white" onClick={() => setCostModalJob(null)}>Cancel</button><button className="ss-btn ss-btn-primary" onClick={save}>Save cost</button></div>
      </section>
    </div>
  );
}
