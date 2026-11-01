import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { PageLayout } from '../src/components/PageLayout';
import { PageTitle } from '../src/components/employee/PageTitle';

describe('shared page-title contract', () => {
  test('workspace title is first, with subtitle and optional action', () => {
    const html = renderToStaticMarkup(createElement(PageLayout, {
      title: 'Jobs',
      description: 'Your current work.',
      actions: createElement('button', null, 'New Job'),
      children: 'Content',
    }));
    expect(html).toMatch(/<header[^>]*><div[^>]*><h1/);
    expect(html).toContain('text-2xl');
    expect(html).toContain('font-bold');
    expect(html).toContain('!text-sm');
    expect(html).toContain('text-slate-500');
    expect(html).toContain('New Job');
    expect(html).not.toContain('WORKSPACE');
  });

  test('employee title has the same title-first typography', () => {
    const html = renderToStaticMarkup(createElement(PageTitle, {
      title: 'Today',
      description: 'Your assigned work.',
    }));
    expect(html).toMatch(/^<div[^>]*><div[^>]*><h1/);
    expect(html).toContain('text-2xl');
    expect(html).toContain('font-bold');
    expect(html).toContain('!text-sm');
    expect(html).toContain('text-slate-500');
  });

  test('shared title and panel components cannot accept an eyebrow prop', () => {
    for (const path of [
      'src/components/PageLayout.tsx',
      'src/components/employee/PageTitle.tsx',
      'src/components/employee/PageTitleView.tsx',
      'src/components/ui/section-header.tsx',
      'src/components/schedule/Schedule.tsx',
      'src/components/schedule/BookingEditor.tsx',
    ]) {
      expect(readFileSync(path, 'utf8')).not.toMatch(/\b(?:eyebrow|kicker)\b/i);
    }
  });

  test('no screen puts a fixed text kicker before its page heading', () => {
    const violations: string[] = [];
    function scan(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) { scan(path); continue; }
        if (!path.endsWith('.tsx')) continue;
        const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        function visit(node: ts.Node) {
          if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'h1' && ts.isJsxElement(node.parent)) {
            const siblings = node.parent.children;
            for (const before of siblings.slice(0, siblings.indexOf(node))) {
              if (!ts.isJsxElement(before) || !['p', 'span', 'h2'].includes(before.openingElement.tagName.getText(source))) continue;
              // Changing references, statuses and dates remain legitimate context.
              if (before.children.some(ts.isJsxExpression)) continue;
              const text = before.children.filter(ts.isJsxText).map(part => part.text.trim()).join(' ').trim();
              if (text) violations.push(`${path}: ${text}`);
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    scan('src');
    expect(violations).toEqual([]);
  });
});
