import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { JobSectionMenu } from '../src/components/JobSectionMenu';
import { AppHeader } from '../src/components/AppHeader';
import { JobHeader } from '../src/components/JobHeader';

test('job-section trigger identifies the current section on every existing job panel', () => {
  for (const [value, label] of [
    ['quote', 'Quote'], ['invoices', 'Invoices'], ['costs', 'Costs'],
    ['changes', 'Variations'], ['stages', 'Stages'], ['documents', 'Documents'],
  ]) {
    const markup = renderToStaticMarkup(<JobSectionMenu value={value} onValueChange={() => {}} />);
    assert.match(markup, new RegExp(`aria-label="Job sections, ${label}"`));
    assert.match(markup, /aria-haspopup="menu"/);
    assert.doesNotMatch(markup, /role="tablist"/);
  }
});

test('job page replaces only the selector and keeps each named content region and notification counts', () => {
  const source = readFileSync('src/pages/ProjectManage.tsx', 'utf8');
  assert.match(source, /<JobSectionMenu[\s\S]*?value=\{activeTab\}[\s\S]*?onValueChange=\{setActiveTab\}/);
  assert.doesNotMatch(source, /<TabsList|<TabsTrigger/);
  for (const [value, label] of [
    ['quote', 'Quote'], ['invoices', 'Invoices'], ['costs', 'Costs'],
    ['changes', 'Variations'], ['stages', 'Stages'], ['documents', 'Documents'],
  ]) {
    assert.match(source, new RegExp(`<TabsContent value="${value}"[^>]+aria-label="${label}"`));
  }
  assert.match(source, /invoiceCount=\{invoices.length\}/);
  assert.match(source, /pendingVariationCount=\{pendingClientRequests.length\}/);
  assert.match(source, /documentNotificationCount=/);
  assert.doesNotMatch(source, /headerActions=/);
  assert.match(source, /<JobHeader>/);
  assert.equal((source.match(/<JobSectionMenu/g) || []).length, 1);
  assert.match(source, /<QuoteSection/);
  assert.match(source, /<InvoiceSection/);
  assert.match(source, /<JobCostsTab/);
  assert.match(source, /<StageManager/);
  assert.match(source, /<DocumentsSection/);
});

test('the job header holds the sticky selector separately from global navigation', () => {
  const globalMarkup = renderToStaticMarkup(<AppHeader onOpenNavigation={() => {}} />);
  const markup = renderToStaticMarkup(<JobHeader>
    <JobSectionMenu value="documents" onValueChange={() => {}} />
  </JobHeader>);
  assert.match(markup, /data-testid="job-header"/);
  assert.match(markup, /sticky/);
  assert.match(markup, /top-16/);
  assert.match(markup, /lg:top-0/);
  assert.match(globalMarkup, /aria-label="Open navigation"/);
  assert.doesNotMatch(globalMarkup, /Job sections/);
  assert.match(markup, /aria-label="Job sections, Documents"/);
});
