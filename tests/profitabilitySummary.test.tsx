import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { profitabilitySummary, type JobProfitability } from '../shared/jobCosting';
import { ProfitabilitySummary } from '../src/components/job-costing/ProfitabilitySummary';

const job = (overrides: Partial<JobProfitability> = {}): JobProfitability => ({
  jobId: 'fixture', jobName: 'Fixture job', clientName: 'Fixture client', status: 'in_progress',
  quotedExGst: 1000, invoicedExGst: 600, approvedVariationsExGst: 200,
  confirmedCostsExGst: 750, draftCostsExGst: 999,
  costsByCategory: { Materials: 750, Subcontractor: 0, 'Plant/Equipment': 0, Labour: 0, Other: 0 },
  ...overrides,
});

test('profit summary uses confirmed ex-GST costs and selected revenue without adding variations twice', () => {
  assert.deepEqual(profitabilitySummary([job()], 'quoted'), {
    revenue: 1000, confirmedCosts: 750, profit: 250, margin: 25, jobCount: 1, excludedJobCount: 0, excludedCosts: 0,
  });
  const invoiced = profitabilitySummary([job()], 'invoiced');
  assert.equal(invoiced.profit, -150);
  assert.equal(invoiced.margin, -25);
});

test('overall margin is revenue weighted, not the average of job percentages', () => {
  const result = profitabilitySummary([
    job({ quotedExGst: 100, confirmedCostsExGst: 0 }),
    job({ quotedExGst: 900, confirmedCostsExGst: 900 }),
  ], 'quoted');
  assert.equal(result.profit, 100);
  assert.equal(result.margin, 10);
});

test('unknown quote revenue is excluded with matching costs, never silently treated as zero', () => {
  const result = profitabilitySummary([job(), job({ quotedExGst: null, confirmedCostsExGst: 200 })], 'quoted');
  assert.equal(result.jobCount, 1);
  assert.equal(result.excludedJobCount, 1);
  assert.equal(result.excludedCosts, 200);
  assert.equal(result.profit, 250);
  assert.equal(profitabilitySummary([job({ quotedExGst: null })], 'quoted').profit, null);
  assert.equal(profitabilitySummary([], 'quoted').margin, null);
});

test('zero revenue retains a loss and unavailable margin; currency sums are rounded', () => {
  const zero = profitabilitySummary([job({ invoicedExGst: 0, confirmedCostsExGst: 100 })], 'invoiced');
  assert.equal(zero.profit, -100);
  assert.equal(zero.margin, null);
  const rounded = profitabilitySummary([
    job({ quotedExGst: 0.1, confirmedCostsExGst: 0.03 }),
    job({ quotedExGst: 0.2, confirmedCostsExGst: 0.02 }),
  ], 'quoted');
  assert.equal(rounded.revenue, 0.3);
  assert.equal(rounded.profit, 0.25);
});

test('summary renders actual profit and margin with calculation explanations', () => {
  const html = renderToStaticMarkup(createElement(ProfitabilitySummary, { jobs: [job()], basis: 'quoted' }));
  assert.match(html, /summary-profit/);
  assert.match(html, /\$250\.00/);
  assert.match(html, /25\.0%/);
  assert.match(html, /summary-margin/);
  assert.match(html, /GST/);
});
