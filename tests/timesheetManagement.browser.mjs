import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MOBILE_TEST_BASE_URL;
if(!base)throw new Error('Set the development preview URL.');
await mkdir('generated-artifacts',{recursive:true});
await build({entryPoints:['tests/employeePortal.fixture.tsx'],bundle:true,format:'esm',jsx:'automatic',alias:{'@':resolve('src')},
  define:{'process.env.NODE_ENV':'"development"'},outfile:'generated-artifacts/timesheet-management.js'});
await writeFile('generated-artifacts/timesheet-management.html','<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/timesheet-management.js"></script>');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney'}).format(new Date());
const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
const monday=date.toISOString().slice(0,10);
const employee={id:'worker',name:'Test field worker',email:'worker@example.invalid',role:'labourer',active:true,hourly_rate:40};
const job={id:'job',name:'Fixture job',client_name:'Fixture client',client_address:'',employee_notes:''};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
try{
 for(const width of [320,390,1280])for(const mode of ['employee','owner','admin']){
  const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const state={entries:[{id:'entry',employee_id:'worker',project_id:'job',work_date:today,started_at:today+'T00:00:00Z',
   ended_at:today+'T02:00:00Z',break_minutes:0,paid_minutes:120,status:'draft',rate_snapshot:null,notes:'Original',created_at:today+'T00:00:00Z'}],submission:null,calls:[],failDelete:false};
  await page.route('**/api/**',async route=>{
   const r=route.request(),path=new URL(r.url()).pathname,method=r.method(),body=r.postDataJSON();
   if(method!=='GET')state.calls.push({path,method,body});
   if(path==='/api/employee/session')return route.fulfill({json:{employee:mode==='owner'?null:{...employee,id:mode==='admin'?'admin-user':'worker',role:mode==='admin'?'admin':'labourer'},canManageTeam:mode!=='employee'}});
   const common={jobs:[job],entries:state.entries,submissions:state.submission?[state.submission]:[],assignments:[],documents:[],notes:[],notifications:[],timezone:'Australia/Sydney',today};
   if(path==='/api/employee/bootstrap')return route.fulfill({json:{...common,employee,hourly_rate:40,permissions:{review_timesheets:false}}});
   if(path==='/api/team/bootstrap')return route.fulfill({json:{...common,employees:[employee],appointments:[],permissions:{},audit:[]}});
   if(method==='PATCH'&&/\/time\/entry$/.test(path)){Object.assign(state.entries[0],body);return route.fulfill({json:{success:true}});}
   if(method==='DELETE'&&/\/time\/entry$/.test(path)){
    if(state.failDelete)return route.fulfill({status:409,json:{error:'Please retry this correction.'}});
    state.entries=[];return route.fulfill({json:{success:true}});
   }
   if(path==='/api/employee/submit'||path==='/api/team/time/entry/submit'){
    state.entries.forEach(e=>e.status='submitted');state.submission={id:'submission',employee_id:'worker',week_start:monday,status:'submitted',review_comment:null};
    return route.fulfill({json:{success:true}});
   }
   if(path==='/api/team/review'){
    state.submission.status=body.decision==='approved'?'approved':'rejected';
    state.entries.forEach(e=>{e.status=body.decision==='approved'?'approved':'draft';e.rate_snapshot=body.decision==='approved'?40:null;});
    return route.fulfill({json:{success:true}});
   }
   return route.fulfill({json:[]});
  });
  const management=mode!=='employee';
  await page.goto(base+'/generated-artifacts/timesheet-management.html?view='+(management?'team-timesheets':'timesheets'));
   if(management) await page.getByRole('button',{name:'Review Test field worker',exact:true}).click();
   const editName=management?'Edit':'Edit time';
   if(management) await page.getByRole('button',{name:'Entry actions',exact:true}).click();
   await page.getByRole(management?'menuitem':'button',{name:editName,exact:true}).click();
  await page.locator(management?'#team-entry-notes':'#entry-notes').fill('Corrected finish record');
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/time/entry')&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:management?'Save correction':'Update draft',exact:true}).click();
  await saved;
   if(management)await page.getByRole('heading',{name:'Edit time entry',exact:true}).waitFor({state:'hidden'});
   else await page.getByRole('button',{name:'Add time',exact:true}).first().waitFor();
  assert.ok(state.calls.some(c=>c.method==='PATCH'&&c.path===`/api/${management?'team':'employee'}/time/entry`&&c.body.notes==='Corrected finish record'),JSON.stringify(state.calls));
  const submitted=page.waitForResponse(r=>/\/(employee\/submit|team\/time\/entry\/submit)$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST');
   await (management
    ? page.getByTestId('timesheet-review-drawer').getByRole('button',{name:'Submit for review',exact:true})
    : page.getByRole('button',{name:'Submit week',exact:true})).click();
  await submitted;
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Submit for review'));
  if(management){
   await page.getByRole('button',{name:'Deny week',exact:true}).click();
   await page.locator('#review-comment').fill('Please check the finish time');
    await page.locator('form[role="dialog"]').filter({has:page.locator('#review-comment')}).getByRole('button').last().click();
    await page.getByTestId('timesheet-review-drawer').getByRole('button',{name:'Submit for review',exact:true}).waitFor();
   assert.ok(state.calls.some(c=>c.path==='/api/team/review'&&c.body.decision==='rejected'));
    await page.getByTestId('timesheet-review-drawer').getByRole('button',{name:'Submit for review',exact:true}).click();
   await page.getByRole('button',{name:'Approve week',exact:true}).click();
    await page.locator('form[role="dialog"]').filter({has:page.locator('#review-comment')}).getByRole('button').last().click();
   await page.getByRole('button',{name:'Reopen week',exact:true}).waitFor();
   await page.getByRole('button',{name:'Reopen week',exact:true}).click();
    await page.locator('form[role="dialog"]').filter({has:page.locator('#review-comment')}).getByText(/posted.*labour|labour.*revers/i).waitFor();
   await page.locator('#review-comment').fill('Correcting a duplicate');
    await page.locator('form[role="dialog"]').filter({has:page.locator('#review-comment')}).getByRole('button').last().click();
    await page.getByRole('button',{name:'Entry actions',exact:true}).waitFor();
  }else{
   state.entries[0].status='draft';state.submission.status='rejected';await page.reload();
    await page.getByRole('button',{name:'Entry actions',exact:true}).waitFor();
  }
   const deleteName='Delete';
   if(management) await page.getByRole('button',{name:'Entry actions',exact:true}).first().click();
   if(!management) await page.getByRole('button',{name:'Entry actions',exact:true}).click();
   await page.getByRole(management?'menuitem':'button',{name:deleteName,exact:true}).first().click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(state.calls.filter(c=>c.method==='DELETE').length,0);
   if(management) await page.getByRole('button',{name:'Entry actions',exact:true}).first().click();
   else await page.getByRole('button',{name:'Entry actions',exact:true}).click();
   await page.getByRole(management?'menuitem':'button',{name:deleteName,exact:true}).first().click();
  state.failDelete=true;
  await page.getByRole('alertdialog').getByRole('button',{name:'Delete entry',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('alert').waitFor();
  assert.equal(state.entries.length,1);
  state.failDelete=false;
  await page.getByRole('alertdialog').getByRole('button',{name:'Delete entry',exact:true}).click();
  await page.getByRole('alertdialog').waitFor({state:'hidden'});
  assert.equal(state.entries.length,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${mode} edit, submit, deny/approve/reopen, confirmed delete and error recovery at ${width}px`);
  await context.close();
 }
}finally{await browser.close();}
