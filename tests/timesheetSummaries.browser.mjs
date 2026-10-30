import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL;
if (!base) throw new Error('Set MOBILE_TEST_BASE_URL to the running development app.');
await mkdir('generated-artifacts', { recursive: true });
await build({ entryPoints: ['tests/employeePortal.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, define: { 'process.env.NODE_ENV': '"development"' }, outfile: 'generated-artifacts/timesheet-summary.js' });
await writeFile('generated-artifacts/timesheet-summary.html', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/timesheet-summary.js"></script>');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
const d = new Date(today+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
const monday = d.toISOString().slice(0,10);
const employee = { id:'self', name:'Fixture employee', email:'self@example.invalid', role:'labourer', active:true, hourly_rate:42 };
const coworker = { ...employee, id:'other', name:'Other team member', hourly_rate:99 };
const job = { id:'job', name:'Fixture job', client_name:'Fixture client', client_address:'', employee_notes:'' };
function entry(id, status, hours, rate, extra={}) {
  return { id, employee_id:employee.id, project_id:job.id, work_date:today,
    started_at:today+'T00:00:00Z', ended_at:new Date(Date.parse(today+'T00:00:00Z')+hours*3600000).toISOString(),
    break_minutes:0, paid_minutes:hours*60, status, rate_snapshot:rate, notes:'', created_at:today+'T00:00:00Z', ...extra };
}
const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of [320,390,1280]) for (const mode of ['employee','owner','admin','missing']) {
    const context = await browser.newContext({ viewport:{width,height:900} });
    const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    const own = [entry('approved','approved',8,mode==='missing'?null:40,{break_minutes:30,paid_minutes:450}),
      entry('pending','submitted',2,null),entry('draft','draft',1,null),
      entry('running','draft',1,null,{ended_at:null,paid_minutes:null})];
    const other = entry('other-draft','draft',1,null,{employee_id:coworker.id});
    const management = mode==='owner'||mode==='admin';
    await page.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/api/employee/session') return route.fulfill({json:{employee:mode==='owner'?null:{...employee,role:mode==='admin'?'admin':'labourer'},canManageTeam:management}});
      if(path==='/api/employee/bootstrap')return route.fulfill({json:{employee,hourly_rate:42,timezone:'Australia/Sydney',today,
        permissions:{review_timesheets:false},jobs:[job],entries:own,submissions:[],assignments:[],documents:[],notes:[],notifications:[]}});
      if(path==='/api/team/bootstrap')return route.fulfill({json:{employees:[employee,coworker],timezone:'Australia/Sydney',
        jobs:[job],entries:[...own,other],submissions:[{id:'submitted',employee_id:employee.id,week_start:monday,status:'approved'}],
        appointments:[],assignments:[],permissions:{},notes:[],documents:[],audit:[]}});
      return route.fulfill({json:[]});
    });
    await page.goto(base+'/generated-artifacts/timesheet-summary.html?view='+(management?'team-timesheets':'timesheets'));
    let summary;
    if(management) {
      const strip=page.getByText('Estimated approved pay',{exact:true}).locator('..');
      if(mode==='missing') {
        assert.match(await strip.innerText(),/Unavailable/);
        assert.match(await strip.innerText(),/missing a recorded rate/);
      } else assert.match(await strip.innerText(),/\$300\.00/);
      await page.getByRole('button',{name:'Review Other team member',exact:true}).click();
      summary=page.getByRole('region',{name:'Timesheet details'});
      await summary.waitFor();
      assert.match(await summary.innerText(),/No approved hours/);
      assert.match(await summary.innerText(),/\$99\.00 \/ hr/);
    } else {
      await page.locator('details summary').click();
      summary=page.getByRole('region',{name:'Timesheet details'});
      await summary.waitFor();
      assert.match(await summary.innerText(),/10h 30m/);
      assert.match(await summary.innerText(),/0h 30m/);
      assert.match(await summary.innerText(),/running clock is excluded/);
      assert.match(await summary.innerText(),/\$42\.00 \/ hr/);
      if(mode==='missing') {
        assert.match(await summary.innerText(),/Unavailable/);
        assert.match(await summary.innerText(),/missing a recorded rate/);
      } else assert.match(await summary.innerText(),/\$300\.00/);
    }
    if(!management) assert.equal(await page.getByText('Other team member',{exact:true}).count(),0);
    else {
      assert.equal(await page.getByText('Other team member',{exact:true}).count(),2,'desktop table and mobile card share the team row');
      await page.getByRole('button',{name:'Close review',exact:true}).click();
      await page.getByRole('button',{name:'Previous week',exact:true}).click();
      await page.getByText('No time recorded this week',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Next week',exact:true}).click();
      await page.getByText('Other team member',{exact:true}).waitFor();
      if(mode==='admin') assert.equal(await page.getByRole('button',{name:'Reopen week',exact:true}).count(),0,'No self approval/reopening');
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
    assert.deepEqual(errors,[]);
    console.log(`PASS ${mode} weekly hours, historical pay, missing rates and privacy at ${width}px`);
    await context.close();
  }
} finally { await browser.close(); }
