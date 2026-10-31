import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { JobSectionMenu } from '../src/components/JobSectionMenu';
import { AppHeader } from '../src/components/AppHeader';
import { JobHeader } from '../src/components/JobHeader';

test('job-section navigation exposes the current section and the complete section set', () => {
  for (const [value, label] of [
    ['overview', 'Overview'], ['quote', 'Quote'], ['invoices', 'Invoices'], ['costs', 'Costs'],
    ['changes', 'Variations'], ['stages', 'Stages'], ['documents', 'Documents'], ['staff', 'Team'],
  ]) {
    const markup = renderToStaticMarkup(<JobSectionMenu value={value} onValueChange={() => {}} />);
    assert.match(markup, /aria-label="Job sections"/);
    assert.match(markup, new RegExp(`aria-label="${label}"`));
    assert.match(markup, new RegExp(`data-testid="job-section-${value}"`));
    assert.doesNotMatch(markup, /All sections|All job sections/);
    assert.doesNotMatch(markup, /More job sections/);
    assert.doesNotMatch(markup, /role="tablist"/);
  }
});

test('job page keeps a horizontal section selector and each named content region', () => {
  const source = readFileSync('src/pages/ProjectManage.tsx', 'utf8');
  const header = readFileSync('src/components/project-manage/ProjectManageHeader.tsx', 'utf8');
  assert.match(source, /<JobSectionMenu[\s\S]*?onValueChange=\{setActiveTab\}/);
  assert.match(source, /onBack=\{\(\) => navigate\('\/projects'\)\}/);
  assert.doesNotMatch(source, /<TabsList|<TabsTrigger/);
  for (const [value, label] of [
    ['overview', 'Overview'], ['quote', 'Quote'], ['invoices', 'Invoices'], ['costs', 'Costs'],
    ['changes', 'Variations'], ['stages', 'Stages'], ['documents', 'Documents'],
  ]) {
    assert.match(source, new RegExp(`<TabsContent value="${value}"[^>]+aria-label="${label}"`));
  }
  assert.match(source, /<JobSectionMenu/);
  assert.match(source, /invoiceCount=\{invoices\.filter/);
  assert.match(source, /pendingVariationCount=\{pendingClientRequests\.length/);
  assert.doesNotMatch(source, /documentCount=\{documents\.length\}/);
  assert.doesNotMatch(source, /headerActions=/);
  assert.match(header, /<JobHeader>/);
  assert.equal((header.match(/<JobSectionMenu/g) || []).length, 0);
  assert.match(header, /<ClientPageActions/);
  assert.match(header, /<ClientDetailsCard/);
  assert.doesNotMatch(header, /Add stages|onTabChange\("stages"\)/);
  assert.match(source, /<QuoteSection/);
  assert.match(source, /<InvoiceSection/);
  assert.match(source, /<JobCostsTab/);
  assert.match(source, /<StageManager/);
  assert.match(source, /<DocumentsSection/);
});

test('the job section selector stays in a scrollable top row separate from global navigation', () => {
  const globalMarkup = renderToStaticMarkup(<AppHeader onOpenNavigation={() => {}} />);
  const markup = renderToStaticMarkup(<JobSectionMenu value="documents" onValueChange={() => {}} />);
  const header = renderToStaticMarkup(<JobHeader><span>Job heading</span></JobHeader>);
  assert.match(markup, /overflow-x-auto/);
  assert.doesNotMatch(markup, /sticky|lg:flex-col/);
  assert.match(header, /data-testid="job-header"/);
  assert.match(globalMarkup, /aria-label="Open navigation"/);
  assert.doesNotMatch(globalMarkup, /Job sections/);
  assert.match(markup, /aria-current="page"/);
  const source = readFileSync("src/components/JobSectionMenu.tsx", "utf8");
  assert.doesNotMatch(source, /<Dialog|All sections/);
});
