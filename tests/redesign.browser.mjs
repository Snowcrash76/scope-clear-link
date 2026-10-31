import { build } from 'esbuild';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { baselineAssets } from './baselineSources.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MOBILE_TEST_BASE_URL;if(!base)throw new Error('Set the development preview URL');
await mkdir('generated-artifacts',{recursive:true});
const baseline=await baselineAssets();
await build({entryPoints:['tests/redesign.fixture.tsx'],bundle:true,format:'esm',jsx:'automatic',alias:{'@':resolve('src')},loader:{'.sql':'text'},
 define:{'process.env.NODE_ENV':'"development"'},outfile:'generated-artifacts/redesign.js',logLevel:'error',
 plugins:[{name:'isolated-synthetic-services',setup(b){
  b.onLoad({filter:/(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/},async()=>({
   contents:await readFile('tests/redesign.services.tsx','utf8'),loader:'tsx',resolveDir:process.cwd()}));
 }},...baseline.plugins]});
await writeFile('generated-artifacts/redesign.html',`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${baseline.css}"><link rel="stylesheet" href="/generated-artifacts/redesign.css"><div id="root"></div><script type="module" src="/generated-artifacts/redesign.js"></script>`);
const pid='20000000-0000-4000-8000-000000000001';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney'}).format(new Date());
const profit={jobId:pid,jobName:'Synthetic North Fitzroy job',clientName:'Synthetic client',status:'in_progress',quotedExGst:27100,
 quoteStatus:'sent',quoteIsEstimate:true,invoicedExGst:1000,approvedVariationsExGst:0,confirmedCostsExGst:689.96,
 confirmedCostsIncGst:758.97,draftCostsExGst:0,draftCostsIncGst:0,
 costsByCategory:{Materials:689.96,Labour:0,Other:0,Subcontractor:0,'Plant/Equipment':0}};
const routes=['/dashboard','/projects','/quotes','/invoices','/clients','/profitability','/team','/team/assignments','/team/timesheets','/team/permissions',`/manage/${pid}`,
 ...['costs','timesheets','invoices','changes','activity','documents','stages'].map(tab=>`/manage/${pid}?tab=${tab}`)];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
const layoutFailures=[];
try{
 for(const width of (process.env.REDESIGN_WIDTHS || '375,1280').split(',').map(Number))for(const routePath of routes.filter(path=>!process.env.REDESIGN_ROUTE||path===process.env.REDESIGN_ROUTE)){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/employee/session')return route.fulfill({json:{employee:null,canManageTeam:true}});
   if(path==='/api/team/bootstrap')return route.fulfill({json:{employees:[{id:'member',name:'Test team member',email:'member@example.invalid',role:'labourer',active:true,hourly_rate:40}],
    jobs:[{id:pid,name:profit.jobName,client_name:profit.clientName}],assignments:[],entries:[],submissions:[],appointments:[],audit:[],timezone:'Australia/Sydney',today}});
   if(path==='/api/job-profitability')return route.fulfill({json:[profit]});
   if(path==='/api/job-costs')return route.fulfill({json:{costs:[],quoteLineItems:[],scopeLinkSetupRequired:false}});
   return route.fulfill({json:[]});
  });
  await page.goto(base+'/generated-artifacts/redesign.html?view='+encodeURIComponent(routePath));
  await page.waitForFunction(()=>document.body.innerText.includes('ScopeClear')&&document.querySelectorAll('main').length>0);
  // Wait for asynchronous data, not a network-idle condition (the app has polling).
  await page.getByRole('heading').first().waitFor();await page.waitForTimeout(250);
  assert.deepEqual(errors,[],`${routePath} runtime errors`);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)){
   console.error(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent?.slice(0,65),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(el=>el.right>innerWidth+1||el.left<0).slice(-30)));
   await page.screenshot({path:'generated-artifacts/redesign-overflow.png',fullPage:true});
  }
  const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  if(!fits)layoutFailures.push(`${routePath} overflows ${width}px`);
  assert.doesNotMatch(await page.locator('body').innerText(),/NaN|Infinity|Something went wrong/);
  if(process.env.REDESIGN_CAPTURE){
   const name=routePath.replace(pid,'job').replace(/[^a-z0-9]+/gi,'-');
   await mkdir(`generated-artifacts/${process.env.REDESIGN_CAPTURE}`,{recursive:true});
   await page.screenshot({path:`generated-artifacts/${process.env.REDESIGN_CAPTURE}/${name}-${width}.png`,fullPage:true});
  }
  if(routePath==='/projects'||routePath==='/profitability')assert.match(await page.locator('body').innerText(),/26,341\.03/);
  if(routePath==='/quotes')assert.match(await page.locator('body').innerText(),/27,100\.00/);
  if(routePath==='/dashboard'){
   const palette=await page.evaluate(()=>{
    const style=getComputedStyle(document.body);
    const primary=document.createElement('span');primary.style.color='hsl(var(--primary))';document.body.append(primary);
    const blue=getComputedStyle(primary).color;primary.remove();
    return {background:style.backgroundColor,font:style.fontFamily,blue};
   });
   assert.equal(palette.background,'rgb(247, 249, 252)');
   assert.equal(palette.blue,'rgb(37, 99, 235)');
   assert.match(palette.font,/Inter/);
   const text=await page.locator('body').innerText();
   assert.doesNotMatch(text,/\+100%|4,850|Roof & Gutter Repair|Expires in 12 days|35% Completion|Target: 10|FX-8402|Senior Estimator|Gateway Active|Cycle start|kirk\.vance@example\.com/);
   assert.equal(await page.getByTestId('nav-variations').count(),0);
   assert.equal(await page.getByRole('button',{name:'All sections',exact:true}).count(),0);
   const smallText=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>{
    const style=getComputedStyle(el);
    return el.getClientRects().length&&style.visibility!=='hidden'&&Array.from(el.childNodes).some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())&&parseFloat(style.fontSize)<12;
   }).map(el=>({text:el.textContent.slice(0,50),size:getComputedStyle(el).fontSize})));
   assert.deepEqual(smallText,[],'No dashboard text below 12px');
   const jobCard=page.getByTestId(`project-list-item-${pid}`);
   const titleBox=await jobCard.getByText(profit.jobName,{exact:true}).boundingBox();
   assert.ok(titleBox.width>130&&titleBox.height<90,'Job title is not squeezed into a narrow column');
   await page.keyboard.press('Control+k');
   await page.getByRole('dialog',{name:'Search jobs, quotes or clients',exact:true}).waitFor();
   await page.keyboard.press('Escape');
   await page.screenshot({path:`generated-artifacts/clean-blue-dashboard-${width}.png`,fullPage:true});
  }
  if(routePath==='/projects')await page.screenshot({path:`generated-artifacts/clean-blue-jobs-${width}.png`,fullPage:true});
  console.log(`${fits?'PASS':'FAIL'} ${routePath} signed-in synthetic data at ${width}px`);
  await page.close();
 }
 assert.deepEqual(layoutFailures,[],'Responsive layout failures');
}finally{await browser.close();}
