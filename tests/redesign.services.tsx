import React from 'react';
const uid='10000000-0000-4000-8000-000000000001';
const pid='20000000-0000-4000-8000-000000000001';
const qid='30000000-0000-4000-8000-000000000001';
const created='2026-10-20T00:00:00Z';
const user={id:uid,email:'owner@example.invalid',user_metadata:{}};
const project={id:pid,user_id:uid,name:'Synthetic North Fitzroy job',client_name:'Synthetic client',
 client_email:'client@example.invalid',client_address:'Test address',status:'in_progress',total_value:27100,
 active_quote_id:qid,created_at:created,updated_at:created};
const quote={id:qid,project_id:pid,quote_number:'QT-001',status:'sent',subtotal:27100,total:29810,
 tax_rate:10,tax_amount:2710,created_at:created,updated_at:created,reference:'Fixture reference',valid_until:null,
 quote_token:'fixture-token',notes:'',terms:''};
const invoice={id:'40000000-0000-4000-8000-000000000001',project_id:pid,invoice_number:'INV-001',status:'overdue',
 subtotal:1000,tax_rate:10,tax_amount:100,total:1100,created_at:created,updated_at:created,due_date:'2026-10-22'};
const tables:Record<string,any[]>={
 projects:[project],quotes:[quote],invoices:[invoice],
 profiles:[{id:uid,user_id:uid,full_name:'Test owner',business_name:'Synthetic trade',business_address:'Test address',abn:'',email:user.email}],
 scope_items:[{id:'scope-one',project_id:pid,title:'Hallway',description:'<ul><li>Prepare the existing surface</li><li>Install the replacement timber</li></ul>',category:'included',cost:27100,acknowledged:false,created_at:created,updated_at:created}],
 quote_line_items:[],project_stages:[],project_documents:[],project_images:[],quote_line_item_history:[],
 change_requests:[{id:'variation-one',project_id:pid,type:'addition',title:'Additional trim',description:'Requested additional work',
  status:'pending',cost_impact:120,created_at:created}],activity_logs:[],user_roles:[{user_id:uid,role:'admin'}],
};
// Opt-in search/pagination matrix. Never imported by production entrypoints.
if ((window as any).__listToolbarFixture) {
 tables.projects = Array.from({length: 13}, (_, index) => ({
  ...project, id:`20000000-0000-4000-8000-${String(index + 1).padStart(12,'0')}`,
  name: index === 0 ? project.name : `Other job ${index + 1}`,
  client_name: index === 0 ? project.client_name : `Other client ${index + 1}`,
  status: ['sent','approved','in_progress'][index % 3],
  active_quote_id:`30000000-0000-4000-8000-${String(index + 1).padStart(12,'0')}`,
 }));
 tables.quotes = tables.projects.map((row,index) => ({
  ...quote, id:row.active_quote_id, project_id:row.id, quote_number:`QT-${String(index + 1).padStart(3,'0')}`,
  status:['sent','approved','draft'][index % 3], reference:index === 0 ? quote.reference : `Other reference ${index + 1}`,
 }));
 tables.invoices = tables.projects.map((row,index) => ({
  ...invoice, id:`40000000-0000-4000-8000-${String(index + 1).padStart(12,'0')}`,
  project_id:row.id, invoice_number:`INV-${String(index + 1).padStart(3,'0')}`,
  status:['overdue','paid','sent'][index % 3],
 }));
 if ((window as any).__listToolbarEmpty) {
  tables.projects=[]; tables.quotes=[]; tables.invoices=[]; tables.change_requests=[];
 }
}
// Opt-in synthetic pipeline matrix; production entrypoints never import this module.
if ((window as any).__pipelineFixture) {
 const rows = [
  ['Synthetic North Fitzroy job', 'draft', 'draft', 100],
  ['Sent quote job', 'sent', 'sent', 200],
  ['Approved job', 'draft', 'approved', 300],
  ['In progress job', 'in_progress', 'sent', 400],
  ['Completed job', 'completed', 'draft', 500],
 ];
 tables.projects = rows.map(([name, status, , value], index) => ({
  ...project, id: `20000000-0000-4000-8000-00000000000${index + 1}`, name, status, total_value: value,
  active_quote_id: `30000000-0000-4000-8000-00000000000${index + 1}`,
 }));
 tables.quotes = rows.map(([, , status, value], index) => ({
  ...quote, id: `30000000-0000-4000-8000-00000000000${index + 1}`,
  project_id: tables.projects[index].id, quote_number: `QT-00${index + 1}`, status,
  subtotal: value, total: Number(value) * 1.1, tax_amount: Number(value) * .1,
 }));
 if ((window as any).__pipelineNoDraft) tables.quotes[0].status = 'sent';
  if ((window as any).__pipelineRevised) tables.quotes[0].status = 'revised';
 if ((window as any).__pipelineNoQuoted) {
  tables.projects[0].status = 'completed';
  tables.projects[1].status = 'completed';
 }
  // A superseded draft on a job with a current sent quote must not count.
  tables.quotes.push({
   ...tables.quotes[1], id: 'historical-draft', quote_number: 'OLD-DRAFT', status: 'draft',
   created_at: '2000-01-01T00:00:00.000Z', updated_at: '2000-01-01T00:00:00.000Z',
   subtotal: 9999, total: 10998.9, tax_amount: 999.9,
  });
 tables.project_stages = tables.projects.map(row => ({
  id: `stage-${row.id}`, project_id: row.id, name: 'deposit', status: 'current',
  description: '', invoice_percentage: 10, invoice_amount: 10, sort_order: 0,
 }));
 tables.invoices = [];
 tables.change_requests = [];
}
if ((window as any).__quietJobFixture) {
 tables.change_requests = [];
 tables.invoices = [];
 quote.status = 'accepted';
}
function query(table:string){
 let rows=[...(tables[table]||[])],single=false,mutation:{action:string;value?:any}|null=null;
 const chain:any={
  select:()=>chain,eq:(key:string,value:any)=>{rows=rows.filter(r=>r[key]===value);return chain;},
  in:(key:string,values:any[])=>{rows=rows.filter(r=>values.includes(r[key]));return chain;},
  neq:(key:string,value:any)=>{rows=rows.filter(r=>r[key]!==value);return chain;},
  order:()=>chain,limit:()=>chain,range:()=>chain,or:()=>chain,not:()=>chain,is:()=>chain,
  lt:()=>chain,lte:()=>chain,gt:()=>chain,gte:()=>chain,ilike:()=>chain,
  single:()=>{single=true;return chain;},maybeSingle:()=>{single=true;return chain;},
  update:(value:any)=>{mutation={action:'update',value};return chain;},
  insert:(value:any)=>{mutation={action:'insert',value};return chain;},
  upsert:(value:any)=>{mutation={action:'insert',value};return chain;},
  delete:()=>{mutation={action:'delete'};return chain;},
  then:(resolve:any)=>{
   if(mutation)((window as any).__fixtureMutationCalls||=[]).push({table,...mutation});
   if(mutation?.action==='update')rows.forEach(r=>Object.assign(r,mutation!.value));
   if(mutation?.action==='insert'){rows=[{id:'fixture-created',...mutation.value}];(tables[table]||=[]).push(...rows);}
   if(mutation?.action==='delete')tables[table]=(tables[table]||[]).filter(r=>!rows.includes(r));
   return Promise.resolve({data:single?rows[0]??null:rows,error:null,count:rows.length}).then(resolve);
  },
 };
 return chain;
}
export const supabase={
 from:query,
 auth:{getSession:async()=>({data:{session:{access_token:'synthetic-fixture-only',user}},error:null}),
  getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
 rpc:async(name:string)=>({data:name.includes('invoice')?'INV-FIXTURE':true,error:null}),functions:{invoke:async()=>({data:{success:true},error:null})},
 storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}}),createSignedUrl:async()=>({data:{signedUrl:''},error:null})})},
 channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{},
};
export function useAuth(){const anonymous=Boolean((window as any).__fixtureAnonymous);return {user:anonymous?null:user,session:anonymous?null:{user,access_token:'synthetic-fixture-only'},profile:anonymous?null:tables.profiles[0],loading:false,isAdmin:!anonymous,signOut:async()=>{},signIn:async()=>({error:null}),signUp:async()=>({error:null})};}
export function AuthProvider({children}:{children:React.ReactNode}){return <>{children}</>;}
