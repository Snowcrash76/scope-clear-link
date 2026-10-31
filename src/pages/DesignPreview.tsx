import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowUpRight, CircleCheck, FileText, Layers3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { KpiCard } from "@/components/KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const swatches = [
  { label: "Ink", color: "bg-foreground" },
  { label: "Field blue", color: "bg-primary" },
  { label: "Canvas", color: "bg-background" },
  { label: "Quiet border", color: "bg-border" },
  { label: "Recorded", color: "bg-success" },
  { label: "Needs attention", color: "bg-warning" },
];

export default function DesignPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3 text-foreground no-underline">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-heading text-sm font-extrabold tracking-tight text-primary-foreground">SC</span>
            <span>
              <span className="block font-heading text-base font-extrabold tracking-tight">ScopeClear</span>
              <span className="block text-xs text-muted-foreground">Interface preview · Development only</span>
            </span>
          </Link>
          <Link to="/login" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
            Sign in <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-14">
        <section className="grid gap-7 border-b border-border pb-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Visual system / field notes</p>
            <h1 className="mt-4 max-w-3xl font-heading text-4xl font-extrabold leading-[1.04] tracking-[-.06em] sm:text-6xl">
              Clear work. Clear records.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              A practical interface language for trade teams: quietly confident, readable at a glance and precise about what each number means.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Layers3 className="h-5 w-5" /></span>
              <div>
                <p className="font-semibold">Design principles</p>
                <p className="text-sm text-muted-foreground">Readable, truthful, deliberate.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["01", "Numbers carry their GST basis."],
                ["02", "Actions reflect real product capability."],
                ["03", "Status stays visible across workflows."],
              ].map(([index, text]) => (
                <div key={index} className="flex items-start gap-3 border-t border-border pt-3 text-sm">
                  <span className="font-mono text-xs text-primary">{index}</span>
                  <span className="text-muted-foreground">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-10 py-10 md:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">01 / Foundations</p>
            <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight">Color with a job to do.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Deep blue anchors navigation and action. Quiet blue-grey surfaces separate work without fighting the content.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {swatches.map(({ label, color }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-3">
                <div className={`h-16 rounded-xl border border-border/60 ${color}`} />
                <p className="mt-3 text-sm font-semibold">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Theme token</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-10 border-t border-border py-10 md:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">02 / Components</p>
            <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight">Status is plain language.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Pills and labels stay secondary to the work. They explain the record instead of decorating it.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
                <span className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning">Awaiting response</span>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Quote</p>
              <h3 className="mt-1 font-heading text-lg font-bold">Scope agreed in one place</h3>
              <p className="mt-2 text-sm text-muted-foreground">Subtotal (ex GST) <span className="font-semibold text-foreground">—</span></p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success"><ShieldCheck className="h-5 w-5" /></div>
                <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success">Recorded</span>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Client decision</p>
              <h3 className="mt-1 font-heading text-lg font-bold">A clear audit trail</h3>
              <p className="mt-2 text-sm text-muted-foreground">Decision status <span className="font-semibold text-foreground">—</span></p>
            </article>
          </div>
        </section>

        <section className="grid gap-10 border-t border-border py-10 md:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">03 / Accessible by default</p>
            <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight">Built for the long shift.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Touch-sized controls, visible focus, reduced-motion support and layouts that give the work room to breathe.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <CircleCheck className="h-5 w-5 text-success" aria-hidden="true" />
              <div>
                <p className="font-semibold">Quote summary</p>
                <p className="text-sm text-muted-foreground">Labels stay explicit; unavailable data stays unavailable.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/70 p-3"><span className="text-xs text-muted-foreground">Subtotal (ex GST)</span><p className="mt-2 font-mono font-semibold">—</p></div>
              <div className="rounded-xl bg-muted/70 p-3"><span className="text-xs text-muted-foreground">GST</span><p className="mt-2 font-mono font-semibold">—</p></div>
              <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:col-span-1"><span className="text-xs text-muted-foreground">Total (inc GST)</span><p className="mt-2 font-mono font-semibold">—</p></div>
            </div>
          </div>
        </section>

        <section className="space-y-6 border-t border-border py-10" aria-labelledby="component-toolbox">
          <h2 id="component-toolbox" className="text-xl font-semibold">Job Quick Actions &amp; Status Badges</h2>
          <p className="text-sm text-muted-foreground">Component demonstrations only. These controls do not send, save or delete any customer data.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setDialogOpen(true)}>Preview action</Button>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>Secondary action</Button>
            <Button variant="ghost" onClick={() => setDialogOpen(true)}>Quiet action</Button>
            <Button variant="destructive" onClick={() => setDialogOpen(true)}>Destructive action</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {["draft", "sent", "approved", "in_progress", "overdue", "paid"].map(status => <StatusBadge key={status} status={status} />)}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <KpiCard label="KPI demonstration" value="—" description="No business data in this preview." definition="This component displays a caller-provided value and its definition." href="#component-toolbox" />
            <div className="rounded-2xl border bg-card p-5">
              <Label htmlFor="preview-field">Form field</Label>
              <Input id="preview-field" placeholder="Enter a value" className="mt-2" aria-describedby="preview-field-help" />
              <p id="preview-field-help" className="mt-2 text-sm text-muted-foreground">Visible labels and clear field guidance.</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="p-4 text-left font-semibold">Table demonstration</caption>
              <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th className="p-4">Component</th><th className="p-4">State</th></tr></thead>
              <tbody><tr className="border-t"><td className="p-4">Status badge</td><td className="p-4"><StatusBadge status="draft" /></td></tr></tbody>
            </table>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6 text-center"><h3 className="font-semibold">No items yet</h3><p className="mt-2 text-sm text-muted-foreground">An honest empty state gives the next step without inventing a record.</p></div>
            <div className="space-y-3 rounded-2xl border bg-card p-6" aria-label="Loading component demonstration"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-1/2" /></div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent><DialogHeader><DialogTitle>Component demonstration</DialogTitle><DialogDescription>No customer record is changed by this preview.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Close preview</Button></DialogFooter></DialogContent>
          </Dialog>
        </section>
        <footer className="flex flex-col justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>ScopeClear interface preview · This page contains no customer or job data.</p>
          <Link to="/login" className="font-semibold text-primary hover:underline">Return to sign in</Link>
        </footer>
      </div>
    </main>
  );
}
