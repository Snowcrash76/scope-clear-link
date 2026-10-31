import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusBadge } from '../src/components/StatusBadge';
import { StaticRouter } from 'react-router-dom/server';
import { JobCard } from '../src/components/JobCard';
import type { Project } from '../src/types/project';
import type { QuoteSummary } from '../src/lib/quoteDisplay';

const css = readFileSync('src/index.css', 'utf8');
const tokens = new Map(Array.from(css.matchAll(/--([\w-]+):\s*([^;]+);/g), match => [match[1], match[2].trim()]));
function rgb(name: string): number[] {
  let value = tokens.get(name)!;
  for (let i = 0; value.startsWith('var(') && i < 10; i++) value = tokens.get(value.slice(6, -1))!;
  const [h, s, l] = value.split(/\s+/).map(parseFloat);
  const saturation = s / 100, lightness = l / 100;
  const a = saturation * Math.min(lightness, 1 - lightness);
  return [0, 8, 4].map(n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  });
}
function contrast(a: number[], b: number[]) {
  const luminance = (color: number[]) => color.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
test('Clean blue tokens reproduce the requested palette and single Inter family', () => {
  for (const [name, hex] of Object.entries({
    background: 'F7F9FC', card: 'FFFFFF', border: 'E3E8F0', foreground: '0F172A',
    'muted-foreground': '5B6577', primary: '2563EB', 'primary-hover': '1D4ED8',
    'primary-soft': 'EAF0FF', success: '15803D', 'success-soft': 'E8F6EE',
    warning: 'B45309', 'warning-soft': 'FEF3C7', destructive: 'B91C1C',
    'danger-soft': 'FDECEC', purple: '6D28D9', 'purple-soft': 'F1EAFE',
  })) {
    assert.deepEqual(rgb(name), hex.match(/../g)!.map(v => parseInt(v, 16)), name);
  }
  assert.equal((css.match(/fonts\.googleapis\.com/g) || []).length, 1);
  assert.doesNotMatch(css, /Manrope|DM Sans|Avenir Next/);
});
test('text token pairs satisfy AA on their actual base and semantic surfaces', () => {
  for (const [foreground, background] of [
    ['foreground', 'background'], ['muted-foreground', 'background'], ['muted-foreground', 'card'],
    ['primary-foreground', 'primary'], ['primary-foreground', 'primary-hover'], ['primary', 'primary-soft'],
    ['success', 'success-soft'], ['warning', 'warning-soft'], ['destructive', 'danger-soft'], ['purple', 'purple-soft'],
  ]) {
    assert.ok(contrast(rgb(foreground), rgb(background)) >= 4.5, `${foreground} on ${background}`);
  }
});
test('status badges pair a decorative dot with real readable status labels', () => {
  for (const status of ['draft', 'sent', 'approved', 'in_progress', 'completed', 'declined', 'awaiting_client', 'overdue', 'awaiting_response']) {
    const markup = renderToStaticMarkup(<StatusBadge status={status} />);
    assert.match(markup, /aria-label="Status: [^"]+"/);
    assert.match(markup, /aria-hidden="true"/);
    assert.doesNotMatch(markup, /<svg/);
  }
  assert.match(renderToStaticMarkup(<StatusBadge status="awaiting_client" viewerRole="client" />), /Awaiting Your Approval/);
  assert.match(renderToStaticMarkup(<StatusBadge status="awaiting_client" viewerRole="trade" />), /Sent to Client/);
});

test('job cards hide unsupported metadata and missing quote amounts instead of inventing values', () => {
  const project = { id: 'job-test', name: 'Real job', clientName: '', stages: [] } as unknown as Project;
  const markup = renderToStaticMarkup(<StaticRouter location="/dashboard"><JobCard project={project} status="draft" /></StaticRouter>);
  assert.match(markup, /href="\/manage\/job-test"/);
  assert.match(markup, /Open Job/);
  assert.doesNotMatch(markup, /Quote value|Scope category|Assigned to|Quote valid until|progressbar|Gateway Active/);
  const invalidQuote = { subtotal: NaN, valid_until: 'unreadable' } as QuoteSummary;
  const invalidMarkup = renderToStaticMarkup(<StaticRouter location="/dashboard"><JobCard project={project} quote={invalidQuote} status="sent" /></StaticRouter>);
  assert.doesNotMatch(invalidMarkup, /NaN|Quote value|Quote valid until|progressbar/);
});

test('job cards display legitimate zero quotes and actual completed-stage progress', () => {
  const project = {
    id: 'job-test', name: 'Real job', clientName: 'Real client',
    stages: [{ name: 'Prep', status: 'completed' }, { name: 'Fit', status: 'current' }],
  } as unknown as Project;
  const quote = { subtotal: 0, valid_until: '2026-12-01', quote_number: 'QT-REAL' } as QuoteSummary;
  const markup = renderToStaticMarkup(<StaticRouter location="/projects"><JobCard project={project} quote={quote} status="in_progress" /></StaticRouter>);
  assert.match(markup, /\$0\.00/);
  assert.match(markup, /Quote value · ex GST/);
  assert.match(markup, /QT-REAL/);
  assert.match(markup, /aria-valuenow="50"/);
  assert.match(markup, /1 of 2 stages/);
});
