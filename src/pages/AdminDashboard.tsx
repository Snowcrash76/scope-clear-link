import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSystemAdmin } from "@/hooks/useSystemAdmin";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { PlatformAdminPortal } from "@/components/platform/PlatformAdminPortal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { InviteCodeSetupHelp } from "@/components/InviteCodeSetupHelp";
import { toast } from "sonner";
import { Copy, Plus, Trash2, TicketCheck, Activity, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface InviteCode { id: string; code: string; label: string | null; used_by_email: string | null; used_at: string | null; created_at: string }
interface ActivityEvent { type: "signup" | "project"; id: string; title: string; subtitle: string; createdAt: string }
async function adminFetch(path: string, options?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to use administrator tools.");
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), ...(options?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed: ${response.status}`);
  return body;
}

function InviteCodes() {
  const client = useQueryClient();
  const [label,setLabel]=useState(""); const [count,setCount]=useState(1); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const query=useQuery<InviteCode[]>({queryKey:["admin-invites"],queryFn:()=>adminFetch("/api/admin/invites"),retry:false});
  const generate=async()=>{setBusy(true);setError("");try{const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const codes=Array.from({length:count},()=>({code:Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join(""),label:label.trim()||null}));await adminFetch("/api/admin/invites",{method:"POST",body:JSON.stringify({codes})});toast.success(`${count} invite code${count===1?"":"s"} created`);setLabel("");setCount(1);await client.invalidateQueries({queryKey:["admin-invites"]});}catch(e){const message=e instanceof Error?e.message:"Invite codes could not be created.";setError(message);toast.error(message)}finally{setBusy(false)}};
  const remove=async(id:string)=>{try{await adminFetch(`/api/admin/invites/${id}`,{method:"DELETE"});await client.invalidateQueries({queryKey:["admin-invites"]});toast.success("Invite code deleted")}catch(e){toast.error(e instanceof Error?e.message:"Could not delete invite code.")}};
  const codes=query.data??[]; const setup=error.includes("Invite codes need database setup")||(query.error instanceof Error&&query.error.message.includes("Invite codes need database setup"));
  return <div className="space-y-5">{(error||query.error)&&<p role="alert" className="text-sm text-destructive">{error||(query.error instanceof Error?query.error.message:"Invite codes could not be loaded.")}</p>}{setup&&<InviteCodeSetupHelp onRetry={()=>{setError("");void query.refetch()}}/>}
    <Card className="space-y-4 p-5"><div className="flex items-center gap-2"><TicketCheck className="h-5 w-5 text-primary"/><h2 className="font-semibold">Generate invite codes</h2></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="invite-label">Internal label (optional)</Label><Input id="invite-label" value={label} onChange={e=>setLabel(e.target.value)} placeholder="For example, June trade association"/></div><div className="space-y-1.5"><Label htmlFor="invite-count">Quantity</Label><Input id="invite-count" type="number" min={1} max={50} value={count} onChange={e=>setCount(Math.max(1,Math.min(50,Number(e.target.value))))}/></div></div><Button onClick={generate} disabled={busy||!!query.error}><Plus className="mr-2 h-4 w-4"/>{busy?"Creating…":`Generate ${count===1?"code":`${count} codes`}`}</Button></Card>
    {query.isLoading?<div className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-14 rounded-lg"/>)}</div>:query.isError?<Button variant="outline" onClick={()=>void query.refetch()}>Retry loading codes</Button>:<div className="space-y-5">{(["Available","Used"] as const).map(group=>{const rows=codes.filter(c=>group==="Used"?!!c.used_at:!c.used_at);return <section key={group}><h3 className="mb-2 font-semibold">{group} <Badge variant="secondary">{rows.length}</Badge></h3>{rows.length?<div className="space-y-2">{rows.map(c=><Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><span className="font-mono font-bold tracking-widest text-primary">{c.code}</span>{c.label&&<span className="ml-3 text-sm text-muted-foreground">{c.label}</span>}{c.used_by_email&&<p className="text-xs text-muted-foreground">Used by {c.used_by_email}</p>}</div>{c.used_at?<Badge variant="outline">Used {format(new Date(c.used_at),"dd MMM yyyy")}</Badge>:<div className="flex gap-1"><Button variant="ghost" size="icon" title="Copy code" onClick={()=>{void navigator.clipboard.writeText(c.code);toast.success("Code copied")}}><Copy className="h-4 w-4"/></Button><Button variant="ghost" size="icon" title="Delete unused code" onClick={()=>void remove(c.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>}</Card>)}</div>:<p className="text-sm text-muted-foreground">{group==="Available"?"No unused codes. Create one above.":"No codes have been used yet."}</p>}</section>})}</div>}
  </div>;
}

function ActivityLog() {
 const query=useQuery<ActivityEvent[]>({queryKey:["admin-activity"],queryFn:()=>adminFetch("/api/admin/activity")});
 if(query.isLoading)return <div className="space-y-2">{[1,2,3,4].map(i=><Skeleton key={i} className="h-16 rounded-lg"/>)}</div>;
 if(query.isError)return <Card className="p-5"><p className="text-sm text-destructive">Activity could not be loaded.</p><Button className="mt-3" variant="outline" onClick={()=>void query.refetch()}>Retry</Button></Card>;
 return query.data?.length?<div className="space-y-2">{query.data.map(e=><Card key={e.id} className="flex min-w-0 items-center gap-3 p-4"><span className="rounded-lg bg-primary/10 p-2"><Activity className="h-4 w-4 text-primary"/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.title}</p><p className="truncate text-xs text-muted-foreground">{e.subtitle}</p></div><time className="shrink-0 text-xs text-muted-foreground">{format(new Date(e.createdAt),"dd MMM yyyy")}</time></Card>)}</div>:<Card className="border-dashed p-8 text-center"><p className="font-medium">No recent activity</p><p className="mt-1 text-sm text-muted-foreground">New sign-ups and jobs will appear here.</p></Card>;
}

export default function AdminDashboard() {
  const {user,loading}=useAuth(); const capability=useSystemAdmin(); const [params,setParams]=useSearchParams();
  if(loading||capability.isLoading)return <PageLayout title="System administration"><div className="space-y-4"><Skeleton className="h-24 rounded-xl"/><Skeleton className="h-12 rounded-xl"/><Skeleton className="h-64 rounded-xl"/></div></PageLayout>;
  if(!user||capability.isError||!capability.data?.admin)return <Navigate to="/dashboard" replace/>;
  const tab=params.get("tab")??"platform";
  const setTab=(value:string)=>setParams(value==="platform"?{}:{tab:value},{replace:true});
  return <PageLayout title="System administration" description="ScopeStream platform operations across every business." className="space-y-5">
    <Tabs value={["platform","invites","activity"].includes(tab)?tab:"platform"} onValueChange={setTab}>
      <div className="overflow-x-auto"><TabsList className="grid w-max min-w-full grid-cols-3 sm:w-full"><TabsTrigger value="platform">Platform</TabsTrigger><TabsTrigger value="invites">Invite codes</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList></div>
      <TabsContent value="platform" className="mt-5"><PlatformAdminPortal/></TabsContent>
      <TabsContent value="invites" className="mt-5"><InviteCodes/></TabsContent>
      <TabsContent value="activity" className="mt-5"><ActivityLog/></TabsContent>
    </Tabs>
  </PageLayout>;
}
