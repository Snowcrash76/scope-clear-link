import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { JobSectionMenu } from '../src/components/JobSectionMenu';
import { AppHeader } from '../src/components/AppHeader';

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
  assert.match(source, /<AppShell\s+headerActions=/);
  assert.equal((source.match(/<JobSectionMenu/g) || []).length, 1);
  assert.match(source, /<QuoteSection/);
  assert.match(source, /<InvoiceSection/);
  assert.match(source, /<JobCostsTab/);
  assert.match(source, /<StageManager/);
  assert.match(source, /<DocumentsSection/);
});

test('the real shared header keeps global navigation separate from the right-hand job selector', () => {
  const markup = renderToStaticMarkup(<AppHeader onOpenNavigation={() => {}} actions={
    <JobSectionMenu value="documents" onValueChange={() => {}} />
  } />);
  assert.match(markup, /data-testid="app-header"/);
  assert.match(markup, /sticky/);
  assert.match(markup, /top-0/);
  assert.match(markup, /aria-label="Open navigation"/);
  assert.match(markup, /aria-label="Job sections, Documents"/);
  assert.match(markup, /ml-auto/);
});
