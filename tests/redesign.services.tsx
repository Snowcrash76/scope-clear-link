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
export function useAuth(){return {user,session:{user,access_token:'synthetic-fixture-only'},profile:tables.profiles[0],loading:false,isAdmin:true,signOut:async()=>{},signIn:async()=>{},signUp:async()=>{}};}
export function AuthProvider({children}:{children:React.ReactNode}){return <>{children}</>;}
