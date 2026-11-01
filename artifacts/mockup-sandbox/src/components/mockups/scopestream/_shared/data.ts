export type StageStatus = "pending" | "complete";
export type JobStatus = "Lead" | "Quoted" | "Approved" | "In Progress" | "Completed";
export interface Quote {
  ref: string;
  amountExGst: number | null;
  validTo: string;
}
export interface Stage {
  id: string;
  name: string;
  amountExGst: number;
  status: StageStatus;
}

export interface Client {
  name: string;
  email: string;
  phone: string;
  address: string;
  projectType: string;
}
export interface CostEntry {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
}
export interface Invoice {
  id: string;
  amountExGst: number | null;
  status: "Draft" | "Sent" | "Paid";
  title: string;
  createdAt: string;
}
export interface Variation {
  id: string;
  title: string;
  amountExGst: number;
  status: "Approved" | "Pending";
  age: string;
}
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  assigned: boolean;
}
export interface Activity {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  kind: "invoice" | "variation";
}
export interface Job {
  id: string;
  name: string;
  ref: string;
  status: JobStatus;
  client: Client;
  scheduledLabel: string;
  validTo: string;
  targetCompletion: string;
  quoteExGst: number | null;
  costBudget: number | null;
  costs: CostEntry[];
  stages: Stage[];
  variations: Variation[];
  invoices: Invoice[];
  team: TeamMember[];
  hoursLogged: number;
  specName: string;
  specVersion: string;
  specStatus: string;
  updated: string;
  jobNumber: string;
  signedOffAt?: string;
}

export const referenceNow = new Date("2026-10-31T12:00:00.000Z");
export const GST_RATE = 0.1;
export const seedJobs: Job[] = [
  {
    id: "north-fitzroy",
    name: "North Fitzroy Job",
    ref: "QT-MVRTAUPM",
    status: "In Progress",
    client: {
      name: "Kirk and Emma",
      email: "kirk.emma@example.com",
      phone: "0400 000 000",
      address: "1 Alfred Cres, North Fitzroy",
      projectType: "Residential Project",
    },
    scheduledLabel: "Mon 14 Oct",
    validTo: "27 Nov 2026",
    targetCompletion: "28 Nov",
    quoteExGst: 27100,
    costBudget: 30358.8,
    costs: [{ id: "cost-initial", amount: 758.97, description: "Initial materials", createdAt: "31 Oct" }],
    stages: [{ id: "deposit", name: "Deposit", amountExGst: 1355, status: "pending" }],
    variations: [],
    invoices: [],
    team: [{ id: "danny", name: "Danny Basaran", role: "Leading Hand", assigned: true }],
    hoursLogged: 0,
    specName: "Job Specifications & Plan",
    specVersion: "V2.1",
    specStatus: "Approved",
    updated: "31 Oct",
    jobNumber: "FX-8842",
  },
  {
    id: "smith-project",
    name: "Smith Project",
    ref: "",
    status: "Completed",
    client: {
      name: "Smith Project client",
      email: "",
      phone: "",
      address: "",
      projectType: "Completed Project",
    },
    scheduledLabel: "",
    validTo: "",
    targetCompletion: "",
    quoteExGst: null,
    costBudget: null,
    costs: [],
    stages: [{ id: "complete", name: "Final payment", amountExGst: 930, status: "complete" }],
    variations: [{ id: "var-pavers", title: "Change Pavers to 600mm", amountExGst: 1450, status: "Approved", age: "1d ago" }],
    invoices: [{ id: "paid-smith", amountExGst: null, status: "Paid", title: "Final invoice", createdAt: "14h ago" }],
    team: [],
    hoursLogged: 0,
    specName: "Project Scope & Plan",
    specVersion: "V1.0",
    specStatus: "Approved",
    updated: "30 Oct",
    jobNumber: "",
    signedOffAt: "2026-10-30T12:00:00.000Z",
  },
];

export const initialActivity: Activity[] = [
  { id: "activity-invoice", title: "Invoice paid", detail: "Smith Project · Settled via Stripe direct deposit", occurredAt: "2026-10-30T22:00:00.000Z", kind: "invoice" },
  { id: "activity-variation", title: "Variation approved", detail: "Change Pavers to 600mm (Smith Project) · +$1,450.00 ex GST adjusted to quote", occurredAt: "2026-10-30T11:00:00.000Z", kind: "variation" },
];
