import { GST_RATE, type Job } from "../data";

export const quoteIncGst = (quoteExGst: number) => quoteExGst * (1 + GST_RATE);
export const depositAmount = (quoteExGst: number) => quoteExGst * 0.05;
export const costsToDate = (job: Job) => job.costs.reduce((sum, cost) => sum + cost.amount, 0);
export const costPercentOfBudget = (job: Job) => job.costBudget ? costsToDate(job) / job.costBudget : 0;
export const marginAmount = (job: Job) => job.quoteExGst - costsToDate(job);
export const estimatedMargin = (job: Job) => job.quoteExGst ? marginAmount(job) / job.quoteExGst : 0;
export const formatMoney = (value: number) => new Intl.NumberFormat("en-AU", {
  style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
export const formatCompactMoney = (value: number) => new Intl.NumberFormat("en-AU", {
  style: "currency", currency: "AUD", maximumFractionDigits: 0,
}).format(value);
