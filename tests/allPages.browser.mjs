// Render real public/admin/employee surfaces using synthetic APIs only.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { baselineAssets } from './baselineSources.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const phase = process.env.SCREENSHOT_PHASE || 'after';
await mkdir(`generated-artifacts/${phase}`, { recursive: true });
const baseline=await baselineAssets();
await build({
 entryPoints:['tests/allPages.fixture.tsx'], bundle:true,format:'esm',jsx:'automatic',
 alias:{'@':resolve('src')},loader:{'.sql':'text'},
 define:{'process.env.NODE_ENV':'"development"','import.meta.env.DEV':'true'},
 outfile:'generated-artifacts/all-pages.js',logLevel:'error',
 plugins:[{name:'isolated-services',setup(b){
  b.onLoad({filter:/(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/},async()=>({
   contents:await readFile('tests/redesign.services.tsx','utf8'),loader:'tsx',resolveDir:process.cwd()}));
 }},...baseline.plugins]
});
await writeFile('generated-artifacts/all-pages.html',`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${baseline.css}"><link rel="stylesheet" href="/generated-artifacts/all-pages.css"><div id="root"></div><script type="module" src="/generated-artifacts/all-pages.js"></script>`);
const pid='20000000-0000-4000-8000-000000000001';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney'}).format(new Date());
const employee={id:'fixture-member',name:'Synthetic team member',email:'member@example.invalid',role:'labourer',active:true};
const job={id:pid,name:'Synthetic field job',client_name:'Synthetic client',client_address:'Test site address'};
const permissions={view_scope:true,view_variations:true,view_documents:true,add_photos:true,add_notes:true};
const bootstrap={employee,permissions,timezone:'Australia/Sydney',today,jobs:[job],assignments:[],
 entries:[],submissions:[],documents:[],notes:[],notifications:[],pay_summary:null};
const routes=['/','/login','/signup','/forgot-password','/reset-password','/demo',
 '/admin','/admin?tab=users','/admin?tab=invites','/admin?tab=activity',
 '/variations','/missing-page','/employee/login','/employee/accept',
 '/employee/accept?token=fixture-token','/employee','/employee/week',
 `/employee/jobs/${pid}`,'/employee/timesheets','/employee/notifications'];
if(phase!=='before')routes.push('/design-preview');
const widths=(process.env.ALL_PAGES_WIDTHS||'375,1280').split(',').map(Number);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
const results=[];
try{
 for(const width of widths)for(const routePath of routes.filter(path=>!process.env.ALL_PAGES_ROUTE||path===process.env.ALL_PAGES_ROUTE)){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   let data=[];
   if(path==='/api/employee/session')data={employee:routePath.startsWith('/employee')?employee:null,canManageTeam:!routePath.startsWith('/employee')};
   else if(path==='/api/employee/bootstrap')data=bootstrap;
   else if(path===`/api/employee/jobs/${pid}`)data={job,scope:[],variations:[],notes:[],documents:[]};
   else if(path.startsWith('/api/employee/invitations/'))data={name:'Synthetic trade',email:employee.email,expires_at:'2027-01-01T00:00:00Z'};
   else if(path==='/api/admin/stats')data={totalUsers:1,projectsByStatus:{in_progress:1},quotesSent:1,quotesApproved:0,invoicesPaid:0,totalRevenue:0,unusedInviteCodes:0};
   else if(path==='/api/team/bootstrap')data={employees:[employee],jobs:[job],assignments:[],entries:[],submissions:[],appointments:[],audit:[],timezone:'Australia/Sydney',today};
   return route.fulfill({json:data});
  });
  await page.goto(base+'/generated-artifacts/all-pages.html?view='+encodeURIComponent(routePath));
  await page.locator('h1,h2').first().waitFor();
  await page.waitForTimeout(200);
  assert.deepEqual(errors,[],`${routePath} runtime errors`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${routePath} page overflow at ${width}`);
  assert.doesNotMatch(await page.locator('body').innerText(),/NaN|Infinity|Something went wrong/);
  if(routePath==='/design-preview'){
   await page.getByRole('heading',{name:'Job Quick Actions & Status Badges'}).waitFor();
   await page.getByRole('button',{name:'Preview action',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Component demonstration'});
   await dialog.waitFor();
   await page.keyboard.press('Escape');
   await dialog.waitFor({state:'hidden'});
  }
  const name='page-'+routePath.replace(pid,'job').replace(/[^a-z0-9]+/gi,'-');
  // First viewport keeps marketing captures readable and under screenshot limits.
  await page.screenshot({path:`generated-artifacts/${phase}/${name}-${width}.png`,fullPage:routePath==='/design-preview'});
  results.push({route:routePath,width,screenshot:`${name}-${width}.png`});
  console.log(`PASS ${routePath} at ${width}px (synthetic services)`);
  await page.close();
 }
}finally{await browser.close();}
await writeFile(`generated-artifacts/${phase}/all-pages.json`,JSON.stringify(results,null,2));
