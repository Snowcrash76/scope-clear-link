import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { KpiCard } from '../src/components/KpiCard';
import { ListPagination } from '../src/components/ListPagination';
import { StatusBadge } from '../src/components/StatusBadge';
import { readFileSync } from 'node:fs';
const render=(node:React.ReactNode)=>renderToStaticMarkup(<StaticRouter location="/quotes"><TooltipProvider>{node}</TooltipProvider></StaticRouter>);
test('KPI links keep the real target and expose a separate definition control',()=>{
 const html=render(<KpiCard label="Job count" value={0} description="Real count" definition="All jobs" href="/projects?status=in_progress" />);
 assert.match(html,/href="\/projects\?status=in_progress"/);
 assert.match(html,/Job count: definition/);
 assert.match(html,/>0<\/p>/);
 assert.doesNotMatch(html.match(/<a\b[\s\S]*?<\/a>/)?.[0]??'',/<button/);
});
test('KPI filter action is a button and never a fabricated link',()=>{
 const html=render(<KpiCard label="Sent quotes" value={1} description="One real quote" definition="Sent only" onClick={()=>{}} />);
 assert.match(html,/<button/);
 assert.doesNotMatch(html,/<a\s/);
});
test('pagination represents empty, first and last pages with disabled bounds',()=>{
 for(const [page,total,range] of [[1,0,'Showing 0–0 of 0'],[1,12,'Showing 1–10 of 12'],[2,12,'Showing 11–12 of 12']] as const){
  const html=render(<ListPagination page={page} pageSize={10} total={total} onChange={()=>{}} />);
  assert.match(html,/List pagination/);
  assert.ok(html.includes(range));
  assert.match(html,/disabled/);
 }
});
test('invoice and quote states use human labels, visible dots and no raw underscores',()=>{
 for(const [state,label] of [['draft','Draft'],['sent','Sent'],['approved','Approved'],['in_progress','In Progress'],['overdue','Overdue'],['paid','Paid']]){
  const html=render(<StatusBadge status={state}/>);
  assert.ok(html.includes(label),state);
  assert.match(html,/rounded-full/);
  assert.doesNotMatch(html,/in_progress/);
 }
});
test('one Inter family serves CSS and Tailwind and the dev preview is guarded',()=>{
 const css=readFileSync('src/index.css','utf8');
 assert.equal((css.match(/@import url/g)||[]).length,1);
 assert.match(css,/--font-body: "Inter", sans-serif/);
 assert.doesNotMatch(css,/Manrope|DM Sans/);
 assert.match(readFileSync('src/App.tsx','utf8'),/import\.meta\.env\.DEV/);
 assert.doesNotMatch(readFileSync('src/components/schedule/schedule.css','utf8'),/#[0-9a-f]{3,8}\b/i);
});
test('job profit figures are labelled as indicative profit, not as costs',()=>{
 const source=readFileSync('src/pages/ProjectsPage.tsx','utf8');
 assert.match(source,/`Indicative profit · \$\{aud\(result\.profit\)\}/);
 assert.doesNotMatch(source,/`Costs so far · \$\{aud\(result\.profit\)\}/);
});
