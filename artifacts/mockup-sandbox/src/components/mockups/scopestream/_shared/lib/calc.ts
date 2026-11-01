import { GST_RATE, referenceNow, type Job } from "../data";

export const quoteIncGst = (quoteExGst: number | null) => quoteExGst === null ? null : quoteExGst * (1 + GST_RATE);
export const depositAmount = (quoteExGst: number | null) => quoteExGst === null ? null : quoteExGst * 0.05;
export const costsToDate = (job: Job) => job.costs.reduce((sum, cost) => sum + cost.amount, 0);
export const costPercentOfBudget = (job: Job) => job.costBudget ? costsToDate(job) / job.costBudget : 0;
export const marginAmount = (job: Job) => job.quoteExGst === null ? null : job.quoteExGst - costsToDate(job);
export const estimatedMargin = (job: Job) => job.quoteExGst ? (marginAmount(job) ?? 0) / job.quoteExGst : null;
export const formatMoney = (value: number) => new Intl.NumberFormat("en-AU", {
  style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
export const formatCompactMoney = (value: number) => new Intl.NumberFormat("en-AU", {
  style: "currency", currency: "AUD", maximumFractionDigits: 0,
}).format(value);
export const formatKnownMoney = (value: number | null) => value === null ? "—" : formatMoney(value);
export const isInReferenceMonth = (value: string | undefined) => {
  if (!value) return false;
  const date = new Date(value);
  return date.getFullYear() === referenceNow.getFullYear() && date.getMonth() === referenceNow.getMonth();
};
export const relativeAge = (value: string) => {
  const elapsedHours = Math.max(0, Math.floor((referenceNow.getTime() - new Date(value).getTime()) / 3_600_000));
  if (elapsedHours < 1) return "Just now";
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
};
