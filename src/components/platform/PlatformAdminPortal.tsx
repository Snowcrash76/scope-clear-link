import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, Users, ShieldCheck, ChevronRight, RotateCcw, Ban, Archive, KeyRound, UserMinus, AlertTriangle, BriefcaseBusiness, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { platformFetch } from "@/hooks/useSystemAdmin";
import type { PlatformAccount, PlatformAudit, PlatformBusiness, PlatformBusinessDetail, PlatformDirectory, PlatformMembership } from "../../../shared/platformAdmin";

type Action = "suspend" | "reactivate" | "archive" | "password_reset" | "remove" | "delete";
type Target = { kind: "account"; item: PlatformAccount; action: Action } | { kind: "business"; item: PlatformBusiness; action: Action } | { kind: "membership"; item: PlatformMembership; action: "remove" };
type DeletionInfo = { deletedAt?: string | null; deletionState?: "pending" | "failed" | "completed" | null };
const PAGE_SIZE = 8;
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Not recorded";
const controlLabel = (status: string) => status === "active" ? "Active" : status === "suspended" ? "Suspended" : "Archived";
const StateBadge = ({ status }: { status: string }) => <StatusBadge status={status} labelOverride={controlLabel(status)} size="sm" />;
const recordDeletion = (row: { control: PlatformAccount["control"] }) => row.control as PlatformAccount["control"] & DeletionInfo;
function DeletionBadge({ row }: { row: { control: PlatformAccount["control"] } }) {
  const info = recordDeletion(row);
  if (info.deletionState === "pending") return <StatusBadge status="pending" labelOverride="Deletion pending" size="sm" />;
  if (info.deletionState === "failed") return <StatusBadge status="rejected" labelOverride="Deletion failed" size="sm" />;
  if (info.deletionState === "completed" || info.deletedAt) return <StatusBadge status="completed" labelOverride="Deleted · history retained" size="sm" />;
  return null;
}

function Paginator({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground"><span>{total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}` : "0 results"}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button></div></div>;
}

export function PlatformAdminPortal({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  const actorRef = useRef(user?.id);
  actorRef.current = user?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [businessPage, setBusinessPage] = useState(1);
  const [accountPage, setAccountPage] = useState(1);
  const [selected, setSelected] = useState<PlatformBusiness | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<PlatformAccount | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const submitLock = useRef(false);
  useEffect(() => {
    setSelected(null);
    setSelectedAccount(null);
    setTarget(null);
    setReason("");
    setConfirmation("");
    setActionError("");
    setShowDeleted(false);
    setSearch("");
    setBusinessPage(1);
    setAccountPage(1);
    setSaving(false);
  }, [user?.id]);
  const directoryQuery = useQuery({
    queryKey: ["platform-directory", user?.id],
    enabled: !!user?.id,
    queryFn: () => platformFetch<PlatformDirectory>("/directory"),
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: ["platform-business-detail", user?.id, selected?.id],
    enabled: !!user?.id && !!selected?.id,
    queryFn: () => platformFetch<PlatformBusinessDetail>(`/businesses/${encodeURIComponent(selected!.id)}`),
    retry: false,
  });
  const auditQuery = useQuery({
    queryKey: ["platform-audit", user?.id],
    enabled: !!user?.id && tab === "audit",
    queryFn: () => platformFetch<{ ready: boolean; events: PlatformAudit[] }>("/audit"),
    retry: false,
  });
  const directory = directoryQuery.data;
  const accounts = directory?.accounts ?? [];
  const businesses = directory?.businesses ?? [];
  const memberships = directory?.memberships ?? [];
  const q = search.trim().toLocaleLowerCase();
  const visibleBusinesses = useMemo(() => businesses.filter(x => showDeleted || (!(x.control as typeof x.control & DeletionInfo).deletedAt && (x.control as typeof x.control & DeletionInfo).deletionState !== "completed")), [businesses, showDeleted]);
  const visibleAccounts = useMemo(() => accounts.filter(x => showDeleted || (!(x.control as typeof x.control & DeletionInfo).deletedAt && (x.control as typeof x.control & DeletionInfo).deletionState !== "completed")), [accounts, showDeleted]);
  const matchedBusinesses = useMemo(() => visibleBusinesses.filter(x => `${x.name} ${x.email} ${x.contact ?? ""} ${x.abn ?? ""}`.toLocaleLowerCase().includes(q)), [visibleBusinesses, q]);
  const matchedAccounts = useMemo(() => visibleAccounts.filter(x => `${x.name} ${x.email}`.toLocaleLowerCase().includes(q)), [visibleAccounts, q]);
  const pagedBusinesses = matchedBusinesses.slice((businessPage - 1) * PAGE_SIZE, businessPage * PAGE_SIZE);
  const pagedAccounts = matchedAccounts.slice((accountPage - 1) * PAGE_SIZE, accountPage * PAGE_SIZE);
  const actionable = !!directory?.ready;
  const deletionReady = (directory as (PlatformDirectory & { deletionReady?: boolean }) | undefined)?.deletionReady ?? false;
  const protectedTarget = (t: Target) => t.action !== "password_reset" && (t.kind === "account" ? t.item.systemAdmin : t.kind === "business" ? t.item.systemAdmin : !!accounts.find(a => a.id === t.item.accountId)?.systemAdmin);
  const deletionInfo = (t: Target): DeletionInfo => t.kind === "membership" ? {} : t.item.control as typeof t.item.control & DeletionInfo;
  const pendingDeletion = (t: Target) => ["pending", "failed"].includes(deletionInfo(t).deletionState || "");
  const completedDeletion = (t: Target) => deletionInfo(t).deletionState === "completed" || !!deletionInfo(t).deletedAt;

  const begin = (next: Target) => {
    if (submitLock.current) return;
    if (protectedTarget(next)) return;
    if (next.action === "delete" ? !deletionReady : !actionable) return;
    if (pendingDeletion(next) && next.action !== "delete") return;
    if (completedDeletion(next)) return;
    setReason(""); setConfirmation(""); setActionError(""); setTarget(next);
  };
  const submitAction = async () => {
    if (submitLock.current || !target) return;
    if (reason.trim().length < 5 || reason.trim().length > 500) { setActionError("Enter a reason between 5 and 500 characters."); return; }
    const expected = target.kind === "account" ? target.item.email : target.item.email;
    if (!expected || confirmation.trim().toLocaleLowerCase() !== expected.trim().toLocaleLowerCase()) { setActionError(expected ? "Type the target email exactly to confirm." : "This target has no recorded email address, so it cannot be confirmed here."); return; }
    const path = target.action === "delete"
      ? target.kind === "account" ? `/accounts/${encodeURIComponent(target.item.id)}/delete` : `/businesses/${encodeURIComponent(target.item.id)}/delete`
      : target.kind === "account" ? `/accounts/${encodeURIComponent(target.item.id)}/action` : target.kind === "business" ? `/businesses/${encodeURIComponent(target.item.id)}/action` : `/memberships/${encodeURIComponent(target.item.id)}/remove`;
    const action = target.action;
    const actorId = user?.id;
    submitLock.current = true;
    setSaving(true);
    setActionError("");
    try {
      const result = await platformFetch<{ success: true; message: string }>(path, { method: "POST", body: JSON.stringify({ ...(target.kind !== "membership" && action !== "delete" ? { action } : {}), reason: reason.trim(), confirmation: confirmation.trim() }) });
      if (!actorId || actorRef.current !== actorId) return;
      toast.success(target.action === "password_reset"
        ? `${result.message || "Password reset request accepted."} Delivery is accepted or queued; inbox delivery is not verified.`
        : result.message || "Action accepted");
      setTarget(null);
      if (target.kind === "business") setSelected(null);
      if (target.kind === "account") setSelectedAccount(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["platform-directory", user?.id] }),
        qc.invalidateQueries({ queryKey: ["platform-business-detail", user?.id] }),
        qc.invalidateQueries({ queryKey: ["platform-audit", user?.id] }),
      ]);
    } catch (error) {
      if (actorRef.current === actorId) setActionError(error instanceof Error ? error.message : "Action could not be completed. Check the details and try again.");
    } finally { submitLock.current = false; setSaving(false); }
  };
  const stats = [
    { label: "Businesses", value: visibleBusinesses.length, icon: Building2 },
    { label: "Auth accounts", value: visibleAccounts.length, icon: Users },
    { label: "Team identities", value: memberships.length, icon: BriefcaseBusiness },
    { label: "Active controls", value: visibleBusinesses.filter(x => x.control.status === "active").length + visibleAccounts.filter(x => x.control.status === "active").length, icon: ShieldCheck },
  ];

  return <div className="space-y-6">
    {!directoryQuery.isLoading && !directoryQuery.isError && directory && !directory.ready && <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Platform controls are not configured</p><p className="mt-1">{directory.setupMessage || "Directory browsing is available, but every control action is disabled until platform administration setup is complete."}</p></div></div>}
    {directoryQuery.isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(n => <Skeleton key={n} className="h-24 rounded-xl" />)}</div> : directoryQuery.isError ? <Card className="p-6"><p className="font-semibold">Platform directory unavailable</p><p className="mt-1 text-sm text-muted-foreground">{directoryQuery.error instanceof Error ? directoryQuery.error.message : "The directory could not be loaded."}</p><Button className="mt-4" variant="outline" onClick={() => void directoryQuery.refetch()}>Retry</Button></Card> : directory && <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(({label,value,icon:Icon})=><Card key={label} className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2.5"><Icon className="h-5 w-5 text-primary"/></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold tracking-tight">{value.toLocaleString()}</p></div></Card>)}</div>
      <p className="text-xs text-muted-foreground">Auth account totals count sign-in accounts only. Membership totals include pending, expired, inactive, and removed staff identities; these are not additional authentication accounts.</p>
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm leading-6 text-blue-950"><p className="font-semibold">History-preserving access deletion</p><p>Delete removes an account identity or business from active administration while retaining jobs, invoices, and other history. It does not delete every staff login. Stop running timers before deleting a business. A completed deletion cannot be restored with the ordinary Restore action. Archive remains available for reversible access changes.</p></div>
      <label className="flex w-fit items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={showDeleted} onChange={e=>{setShowDeleted(e.target.checked);setBusinessPage(1);setAccountPage(1)}}/>Show deleted records</label>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto"><TabsList className="w-max min-w-full justify-start sm:w-full"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="businesses">Businesses</TabsTrigger><TabsTrigger value="accounts">Accounts</TabsTrigger><TabsTrigger value="audit">Admin audit</TabsTrigger>{children}</TabsList></div>
        <TabsContent value="overview" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Platform directory</h2><p className="text-sm text-muted-foreground">A system-wide view of businesses, sign-in accounts, and staff identities.</p></div><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" placeholder="Search businesses and accounts" value={search} onChange={e=>{setSearch(e.target.value);setBusinessPage(1);setAccountPage(1)}}/></div></div>
           <div className="grid gap-5 xl:grid-cols-2"><DirectoryBusinesses rows={matchedBusinesses.slice(0,5)} onSelect={setSelected} /><DirectoryAccounts rows={matchedAccounts.slice(0,5)} onInspect={setSelectedAccount} /></div>
          <p className="text-xs text-muted-foreground">Showing up to five matches in each overview list. Open Businesses or Accounts to browse every result with pagination.</p>
        </TabsContent>
        <TabsContent value="businesses" className="mt-5 space-y-4">
          <SearchBox value={search} onChange={value=>{setSearch(value);setBusinessPage(1)}} placeholder="Search name, email, contact, or ABN"/>
           <DirectoryBusinesses rows={pagedBusinesses} onSelect={setSelected} detailed/>
          <Paginator page={businessPage} total={matchedBusinesses.length} onChange={setBusinessPage}/>
        </TabsContent>
        <TabsContent value="accounts" className="mt-5 space-y-4">
          <SearchBox value={search} onChange={value=>{setSearch(value);setAccountPage(1)}} placeholder="Search account name or email"/>
           <DirectoryAccounts rows={pagedAccounts} actions actionable={actionable} deletionReady={deletionReady} deletionSetupMessage={(directory as (PlatformDirectory & {deletionSetupMessage?:string})|undefined)?.deletionSetupMessage} onInspect={setSelectedAccount} onAction={begin}/>
          <Paginator page={accountPage} total={matchedAccounts.length} onChange={setAccountPage}/>
          <p className="text-xs text-muted-foreground">Auth account counts are separate from pending, expired, and removed staff invitations shown in business details.</p>
        </TabsContent>
        <TabsContent value="audit" className="mt-5">
          {auditQuery.isLoading ? <div className="space-y-2">{[1,2,3].map(n=><Skeleton key={n} className="h-16 rounded-lg"/>)}</div> : auditQuery.isError ? <ErrorPanel message={auditQuery.error instanceof Error ? auditQuery.error.message : "Audit events could not be loaded."} retry={()=>void auditQuery.refetch()}/> : auditQuery.data?.ready ? auditQuery.data.events.length ? <div className="space-y-2">{auditQuery.data.events.map(event=><Card key={event.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{event.target_kind}</Badge><span className="font-medium">{event.action}</span><Badge variant="outline" className={auditOutcomeClass(event.outcome)}>{event.outcome}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{event.reason}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">Target {event.target_id} · Actor {event.actor_id}</p></div><time className="text-xs text-muted-foreground">{date(event.created_at)}</time></Card>)}</div> : <Empty title="No administrator events recorded" detail="Completed platform control actions will appear here."/> : <Empty title="Audit setup is unavailable" detail="Audit events are not ready. Retry after platform audit setup is complete."/>}
        </TabsContent>
      </Tabs>
    </>}
    <BusinessDetail open={!!selected} onOpenChange={open=>{if(!open)setSelected(null)}} detail={detailQuery.data} loading={detailQuery.isLoading} error={detailQuery.isError ? detailQuery.error instanceof Error ? detailQuery.error.message : "Business detail unavailable." : null} retry={()=>void detailQuery.refetch()} actionable={actionable} deletionReady={deletionReady} deletionSetupMessage={(directory as (PlatformDirectory & {deletionSetupMessage?:string})|undefined)?.deletionSetupMessage} accounts={accounts} onAction={begin}/>
    <AccountDetail account={selectedAccount} onOpenChange={open=>{if(!open)setSelectedAccount(null)}} businesses={businesses} memberships={memberships} accounts={accounts}/>
    <ActionDialog target={target} reason={reason} setReason={setReason} confirmation={confirmation} setConfirmation={setConfirmation} saving={saving} error={actionError} onClose={()=>setTarget(null)} onSubmit={submitAction}/>
  </div>;
}

function SearchBox({value,onChange,placeholder}:{value:string;onChange:(v:string)=>void;placeholder:string}) { return <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>; }
function Empty({title,detail}:{title:string;detail:string}) { return <EmptyState title={title} description={detail}/>; }
function ErrorPanel({message,retry}:{message:string;retry:()=>void}) { return <Card className="p-5"><p role="alert" className="text-sm text-destructive">{message}</p><Button className="mt-3" variant="outline" onClick={retry}>Retry</Button></Card>; }

function DirectoryBusinesses({rows,onSelect,detailed=false}:{rows:PlatformBusiness[];onSelect:(b:PlatformBusiness)=>void;detailed?:boolean}) {
  if (!rows.length) return <Empty title="No businesses match" detail="Try another search term." />;
  return <div className="space-y-2">{rows.map(b=><Card key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={()=>onSelect(b)} className="flex min-w-0 flex-1 items-start gap-3 text-left"><span className="rounded-lg bg-primary/10 p-2.5"><Building2 className="h-5 w-5 text-primary"/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-semibold">{b.name}<StateBadge status={b.control.status}/><DeletionBadge row={b}/>{b.systemAdmin&&<Badge variant="outline">Protected admin</Badge>}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{b.email || "Business email not recorded"} · {b.contact || "Contact not recorded"}</span><span className="mt-1 block text-xs text-muted-foreground">{b.memberCount} memberships · {b.projectCount} jobs · {b.quoteCount} quotes · {b.invoiceCount} invoices{detailed?` · Created ${date(b.createdAt)}`:""}</span></span><ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground"/></button></Card>)}</div>;
}

function DirectoryAccounts({rows,actions=false,actionable=false,deletionReady=false,deletionSetupMessage,onAction,onInspect}:{rows:PlatformAccount[];actions?:boolean;actionable?:boolean;deletionReady?:boolean;deletionSetupMessage?:string;onAction?:(t:Target)=>void;onInspect?:(a:PlatformAccount)=>void}) {
  if (!rows.length) return <Empty title="No accounts match" detail="Try another search term." />;
  return <div className="space-y-2">{rows.map(a=>{
    const info=recordDeletion(a); const pending=info.deletionState==="pending"||info.deletionState==="failed"; const completed=info.deletionState==="completed"||!!info.deletedAt;
    return <Card key={a.id} data-testid={`platform-account-${a.id}`} className="min-w-0 space-y-4 p-4">
      <div data-testid={`platform-account-identity-${a.id}`} className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="min-w-0 max-w-full break-words font-semibold [overflow-wrap:anywhere]">{a.name || "Name not recorded"}</span>
          <StateBadge status={a.control.status}/>
          <DeletionBadge row={a}/>
          {a.systemAdmin&&<Badge variant="outline">Protected admin</Badge>}
          {a.providerBanned&&<Badge variant="destructive">Identity provider banned</Badge>}
        </div>
        <p className="mt-1.5 min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{a.email}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs leading-5 text-muted-foreground">
          <span>{a.emailConfirmed?"Email confirmed":"Email unconfirmed"}</span>
          <span>{a.lastSignInAt?`Last sign-in ${date(a.lastSignInAt)}`:"Never signed in"}</span>
          <span>Joined {date(a.createdAt)}</span>
          <span>{a.businessIds.length} owned businesses</span>
          <span>{a.membershipIds.length} staff identities</span>
        </div>
      </div>
      {(onInspect||actions)&&<div data-testid={`platform-account-actions-${a.id}`} className="min-w-0 border-t pt-3">
        <div className="flex min-w-0 flex-wrap gap-2">
          {onInspect&&<Button size="sm" variant="outline" className="flex-[1_1_9rem] sm:flex-none" onClick={()=>onInspect(a)}>Inspect account</Button>}
          {actions&&!completed&&<>{!pending&&<>{a.control.status==="active"?<Button size="sm" variant="outline" className="flex-[1_1_9rem] sm:flex-none" disabled={!actionable||a.systemAdmin} onClick={()=>onAction?.({kind:"account",item:a,action:"suspend"})}><Ban className="mr-1.5 h-4 w-4"/>Suspend</Button>:<Button size="sm" variant="outline" className="flex-[1_1_9rem] sm:flex-none" disabled={!actionable||a.systemAdmin} onClick={()=>onAction?.({kind:"account",item:a,action:"reactivate"})}><RotateCcw className="mr-1.5 h-4 w-4"/>Reactivate</Button>}<Button size="sm" variant="outline" className="flex-[1_1_9rem] sm:flex-none" disabled={!actionable||a.systemAdmin} onClick={()=>onAction?.({kind:"account",item:a,action:"archive"})}><Archive className="mr-1.5 h-4 w-4"/>Archive</Button><Button size="sm" variant="outline" className="flex-[1_1_9rem] sm:flex-none" disabled={!actionable} onClick={()=>onAction?.({kind:"account",item:a,action:"password_reset"})}><KeyRound className="mr-1.5 h-4 w-4"/>Reset password</Button></>}<Button size="sm" variant="outline" className="flex-[1_1_9rem] sm:flex-none" disabled={!deletionReady||a.systemAdmin} onClick={()=>onAction?.({kind:"account",item:a,action:"delete"})}><Trash2 className="mr-1.5 h-4 w-4"/>{pending?"Retry deletion":"Delete account"}</Button></>}
        </div>
        {actions&&(a.systemAdmin||(!actionable&&!pending&&!completed&&!a.systemAdmin)||(!deletionReady&&!completed&&!a.systemAdmin))&&<div className="mt-3 space-y-1.5 text-xs leading-5 text-muted-foreground">
          {a.systemAdmin&&<p>Protected system administrator: suspend, archive, and deletion are unavailable. Password recovery remains available.</p>}
          {!actionable&&!a.systemAdmin&&!pending&&!completed&&<p>Platform controls are not configured; account actions are unavailable.</p>}
          {!deletionReady&&!a.systemAdmin&&!completed&&<p>{deletionSetupMessage||"Deletion setup is unavailable; deletion cannot be submitted."}</p>}
        </div>}
      </div>}
    </Card>;
  })}</div>;
}

function auditOutcomeClass(outcome:string) {
  const normalized=outcome.toLocaleLowerCase();
  if(["completed","accepted","success","succeeded"].includes(normalized)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if(["started","pending","queued","in_progress"].includes(normalized)) return "border-amber-200 bg-amber-50 text-amber-900";
  if(["failed","failure","error","rejected"].includes(normalized)) return "border-red-200 bg-red-50 text-red-800";
  return "text-muted-foreground";
}

function AccountDetail({account,onOpenChange,businesses,memberships,accounts}:{account:PlatformAccount|null;onOpenChange:(open:boolean)=>void;businesses:PlatformBusiness[];memberships:PlatformMembership[];accounts:PlatformAccount[]}) {
  const owned=account?businesses.filter(b=>account.businessIds.includes(b.id)):[];
  const linked=account?memberships.filter(m=>m.accountId===account.id):[];
  const emailKey=account?.email.trim().toLocaleLowerCase();
  const unlinkedMatches=account?memberships.filter(m=>m.email.trim().toLocaleLowerCase()===emailKey&&!m.accountId):[];
  const businessFor=(membership:PlatformMembership)=>{
    const direct=businesses.find(b=>b.id===membership.ownerId);
    const owner=accounts.find(a=>a.id===membership.ownerId);
    return direct?.name||businesses.find(b=>owner?.businessIds.includes(b.id))?.name||"Business relationship not identified";
  };
  return <Dialog open={!!account} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{account?.name||"Account details"}</DialogTitle><DialogDescription>Ownership and team relationships come from the platform directory. Matching email text does not merge distinct identities.</DialogDescription></DialogHeader>{account&&<div className="space-y-5">
    <Card className="grid gap-3 p-4 sm:grid-cols-2"><Detail label="Email">{account.email}</Detail><Detail label="Account control"><StateBadge status={account.control.status}/><DeletionBadge row={account}/></Detail><Detail label="Confirmation">{account.emailConfirmed?"Confirmed":"Unconfirmed"}</Detail><Detail label="Sign-in">{account.lastSignInAt?date(account.lastSignInAt):"Never signed in"}</Detail><Detail label="Identity provider">{account.providerBanned?"Provider-banned":"Not provider-banned"}</Detail><Detail label="Joined">{date(account.createdAt)}</Detail></Card>
    <section><h3 className="mb-2 font-semibold">Owned businesses <span className="text-sm font-normal text-muted-foreground">({owned.length})</span></h3>{owned.length?<div className="space-y-2">{owned.map(b=><Card key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><span className="font-medium">{b.name}</span><span className="flex items-center gap-2"><StateBadge status={b.control.status}/><span className="text-xs text-muted-foreground">{b.email||"Email not recorded"}</span></span></Card>)}</div>:<p className="text-sm text-muted-foreground">No owned business is linked to this account.</p>}</section>
    <section><h3 className="mb-2 font-semibold">Linked staff memberships <span className="text-sm font-normal text-muted-foreground">({linked.length})</span></h3>{linked.length?<div className="space-y-2">{linked.map(m=><Card key={m.id} className="p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{m.name||"Name not recorded"}</span><Badge variant="outline">{m.role}</Badge><Badge variant="secondary">{m.invitation}</Badge>{m.removed&&<Badge variant="outline">Removed</Badge>}{!m.active&&<Badge variant="outline">Inactive</Badge>}</div><p className="mt-1 break-all text-sm text-muted-foreground">{m.email} · {businessFor(m)}</p></Card>)}</div>:<p className="text-sm text-muted-foreground">No linked staff memberships.</p>}</section>
    <section><h3 className="mb-2 font-semibold">Email-matching identities without an auth link <span className="text-sm font-normal text-muted-foreground">({unlinkedMatches.length})</span></h3><p className="mb-2 text-xs text-muted-foreground">These are separate membership records sharing the normalized email address; they are not counted as authenticated accounts.</p>{unlinkedMatches.length?<div className="space-y-2">{unlinkedMatches.map(m=><Card key={m.id} className="p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{m.name||"Name not recorded"}</span><Badge variant="outline">{m.role}</Badge><Badge variant={m.invitation==="pending"?"secondary":"outline"}>{m.invitation}</Badge>{m.removed&&<Badge variant="outline">Removed</Badge>}{!m.active&&<Badge variant="outline">Inactive</Badge>}</div><p className="mt-1 break-all text-sm text-muted-foreground">{m.email} · {businessFor(m)}</p></Card>)}</div>:<p className="text-sm text-muted-foreground">No unlinked membership records with this email.</p>}</section>
  </div>}</DialogContent></Dialog>;
}

function BusinessDetail({open,onOpenChange,detail,loading,error,retry,actionable,deletionReady,deletionSetupMessage,accounts,onAction}:{open:boolean;onOpenChange:(v:boolean)=>void;detail?:PlatformBusinessDetail;loading:boolean;error:string|null;retry:()=>void;actionable:boolean;deletionReady:boolean;deletionSetupMessage?:string;accounts:PlatformAccount[];onAction:(t:Target)=>void}) {
  const b=detail?.business;
  const info=b?recordDeletion(b):null;
  const pending=info?.deletionState==="pending"||info?.deletionState==="failed";
  const completed=info?.deletionState==="completed"||!!info?.deletedAt;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2"><Building2 className="h-5 w-5 text-primary"/>{b?.name||"Business details"}</DialogTitle><DialogDescription>Stored business profile, linked jobs, and staff identities.</DialogDescription></DialogHeader>
    {loading?<div className="space-y-3">{[1,2,3].map(n=><Skeleton key={n} className="h-14 rounded-lg"/>)}</div>:error?<ErrorPanel message={error} retry={retry}/>:b&&<div className="space-y-5">
       <Card className="grid gap-3 p-4 sm:grid-cols-2"><Detail label="Status"><StateBadge status={b.control.status}/><DeletionBadge row={b}/>{b.systemAdmin&&<Badge className="ml-2" variant="outline">Protected admin</Badge>}</Detail><Detail label="Business email">{b.email||"Not recorded"}</Detail><Detail label="Contact">{b.contact||"Not recorded"}</Detail><Detail label="Phone">{b.phone||"Not recorded"}</Detail><Detail label="ABN">{b.abn||"Not recorded"}</Detail><Detail label="Address">{b.address||"Not recorded"}</Detail><Detail label="Website">{b.website||"Not recorded"}</Detail><Detail label="Created">{date(b.createdAt)}</Detail><Detail label="Business login">{b.loginExists?"Account exists":"No linked login"}</Detail><Detail label="Last sign-in">{b.lastSignInAt?date(b.lastSignInAt):"Never signed in"}</Detail></Card>
       <section><h3 className="mb-2 font-semibold">Business access controls</h3><div className="flex flex-wrap gap-2">{!pending&&!completed&&<>{b.control.status==="active"?<Button variant="outline" disabled={!actionable||b.systemAdmin} onClick={()=>onAction({kind:"business",item:b,action:"suspend"})}><Ban className="mr-2 h-4 w-4"/>Restrict business</Button>:<Button variant="outline" disabled={!actionable||b.systemAdmin} onClick={()=>onAction({kind:"business",item:b,action:"reactivate"})}><RotateCcw className="mr-2 h-4 w-4"/>Reactivate</Button>}<Button variant="outline" disabled={!actionable||b.systemAdmin} onClick={()=>onAction({kind:"business",item:b,action:"archive"})}><Archive className="mr-2 h-4 w-4"/>Archive access</Button></>} {!completed&&<Button variant="outline" disabled={!deletionReady||b.systemAdmin} onClick={()=>onAction({kind:"business",item:b,action:"delete"})}><Trash2 className="mr-2 h-4 w-4"/>{pending?"Retry deletion":"Delete business"}</Button>}</div>{b.systemAdmin?<p className="mt-2 text-xs text-muted-foreground">Protected system administrator business: all mutations, including deletion, are unavailable.</p>:!actionable&&!pending&&!completed?<p className="mt-2 text-xs text-muted-foreground">Platform controls are not configured; access actions are unavailable.</p>:null}{!deletionReady&&!completed?<p className="mt-2 text-xs text-muted-foreground">{deletionSetupMessage||"Deletion setup is unavailable; deletion cannot be submitted."}</p>:null}<p className="mt-2 text-xs text-muted-foreground">Restriction affects owner, staff, and public client portal access. Previously issued file URLs can remain valid until expiry. Before deletion, stop running timers. Business deletion removes it from active administration but preserves its jobs, invoices, and history; it does not delete every staff login.</p></section>
      <section><h3 className="mb-2 font-semibold">Jobs <span className="text-sm font-normal text-muted-foreground">({detail?.projects.length||0})</span></h3>{detail?.projects.length?<div className="space-y-2">{detail.projects.map(p=><Card key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><span className="min-w-0 font-medium">{p.name||"Untitled job"}</span><span className="flex items-center gap-2"><Badge variant="outline">{p.status||"Status not recorded"}</Badge><time className="text-xs text-muted-foreground">{date(p.created_at)}</time></span></Card>)}</div>:<p className="text-sm text-muted-foreground">No jobs recorded.</p>}</section>
       <section><h3 className="mb-2 font-semibold">Team identities <span className="text-sm font-normal text-muted-foreground">({detail?.memberships.length||0}; authentication accounts are listed separately)</span></h3>{detail?.memberships.length?<div className="space-y-2">{detail.memberships.map(m=><Card key={m.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium">{m.name||"Name not recorded"} <Badge variant="outline" className="ml-1">{m.role}</Badge></p><p className="break-all text-sm text-muted-foreground">{m.email}</p><div className="mt-1 flex flex-wrap gap-1.5"><Badge variant="secondary">{m.invitation}</Badge>{m.removed&&<Badge variant="outline">Removed</Badge>}{!m.active&&<Badge variant="outline">Inactive</Badge>}<Badge variant="outline">{m.accountId?"Linked auth account":"No auth account"}</Badge></div></div>{!pending&&!completed&&<Button size="sm" variant="outline" disabled={!actionable||!!accounts.find(a=>a.id===m.accountId)?.systemAdmin} onClick={()=>onAction({kind:"membership",item:m,action:"remove"})}><UserMinus className="mr-1.5 h-4 w-4"/>Remove member</Button>}</Card>)}</div>:<p className="text-sm text-muted-foreground">No team memberships recorded.</p>}</section>
    </div>}
  </DialogContent></Dialog>;
}
function Detail({label,children}:{label:string;children:React.ReactNode}){return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 break-words text-sm font-medium">{children}</div></div>}
function ActionDialog({target,reason,setReason,confirmation,setConfirmation,saving,error,onClose,onSubmit}:{target:Target|null;reason:string;setReason:(v:string)=>void;confirmation:string;setConfirmation:(v:string)=>void;saving:boolean;error:string;onClose:()=>void;onSubmit:()=>void}) {
  const verb=target?.action==="suspend"?"suspend":target?.action==="reactivate"?"reactivate":target?.action==="archive"?"archive access for":target?.action==="password_reset"?"request a password reset for":target?.action==="delete"?"delete access for":"remove";
  const subject=target?.kind==="account"?target.item.email:target?.kind==="business"?target.item.name:target?.item.email;
  const expected=target?.kind==="business"?target.item.email:subject;
  const reasonLength=reason.trim().length;
  const reasonValid=reasonLength>=5&&reasonLength<=500;
  const confirmationValid=!!expected&&confirmation.trim().toLocaleLowerCase()===expected.trim().toLocaleLowerCase();
  const valid=!!target&&reasonValid&&confirmationValid;
  const isDelete=target?.action==="delete";
  return <Dialog open={!!target} onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{isDelete?"Confirm history-preserving deletion":"Confirm action"}</DialogTitle><DialogDescription>You are about to {verb} <strong className="break-all">{subject}</strong>. This action will be recorded in the administrator audit log.</DialogDescription></DialogHeader>
    {target?.action==="archive"&&<div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Archive preserves history and removes access. You can use the ordinary restore action later.</div>}
    {target?.action==="suspend"&&target.kind==="business"&&<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">This restricts owner, staff, and public client portal access. Previously issued file URLs can remain usable until expiry.</div>}
    {target?.action==="password_reset"&&<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">A reset request may be accepted or queued for delivery. This does not confirm inbox delivery. No password is displayed or set here.</div>}
    {isDelete&&<div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-5 text-amber-950"><p className="font-semibold">This removes access, not business history.</p>{target?.kind==="business"?<p className="mt-1">Stop running timers first. The business will leave the active admin directory; jobs, invoices, and history remain. Other staff login identities are not deleted. This deletion cannot be reversed with Restore.</p>:<p className="mt-1">The account sign-in identity is soft-deleted while linked business and financial history is retained. This deletion cannot be reversed with Restore.</p>}</div>}
    <div className="space-y-4">
      <label className="block text-sm font-medium">Reason <span className="font-normal text-muted-foreground">(5–500 characters)</span><Textarea className="mt-1.5 min-h-24 resize-y" maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Record the operational reason for this change" aria-invalid={reasonLength>0&&!reasonValid} aria-describedby="platform-action-reason-hint"/><span id="platform-action-reason-hint" className={`mt-1 block text-xs ${reasonLength>0&&!reasonValid?"text-destructive":"text-muted-foreground"}`}>{reasonLength<5?`Enter at least 5 characters (${reasonLength}/500).`:`${reasonLength}/500 characters`}</span></label>
      <label className="block text-sm font-medium">Type the target email to confirm <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">{expected||"No target email recorded"}</span><Input className="mt-1.5 min-h-11" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" inputMode="email" aria-invalid={confirmation.length>0&&!confirmationValid} aria-describedby="platform-action-confirm-hint"/><span id="platform-action-confirm-hint" className={`mt-1 block text-xs ${confirmation.length>0&&!confirmationValid?"text-destructive":"text-muted-foreground"}`}>{!expected?"This action needs a recorded target email to confirm.":confirmationValid?"Email matches.":"Enter the email exactly as shown above."}</span></label>
      {error&&<div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
    </div>
    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button><Button onClick={onSubmit} disabled={!valid||saving} className="w-full sm:w-auto">{saving?"Submitting…":isDelete?"Confirm deletion":"Confirm action"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
