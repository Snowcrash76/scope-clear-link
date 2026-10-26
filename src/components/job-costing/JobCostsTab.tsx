import { useMemo, useState } from 'react';
import { AlertCircle, FileText, Paperclip, Pencil, Plus, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { useJobCosts, COST_CATEGORIES, calculateGst, jobCostInputSchema, aud, uploadCostReceipt, getCostReceiptUrl } from '@/hooks/useJobCosts';
import type { JobCost, JobCostInput } from '@/hooks/useJobCosts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { JobCostSetupHelp, isJobCostSetupError } from '@/components/job-costing/JobCostSetupHelp';

type FormState = {
  supplier: string; description: string; cost_date: string; category: typeof COST_CATEGORIES[number];
  amount_ex_gst: string; amount_inc_gst: string; gst_applies: boolean; reference_number: string;
  notes: string; status: 'draft' | 'confirmed'; quote_line_item_id: string; receipt_image_url: string | null;
};
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const freshForm = (): FormState => ({ supplier: '', description: '', cost_date: localDate(), category: 'Materials', amount_ex_gst: '', amount_inc_gst: '', gst_applies: true, reference_number: '', notes: '', status: 'draft', quote_line_item_id: '', receipt_image_url: null });
const errText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function JobCostsTab({ jobId }: { jobId: string }) {
  const { costs, quoteLineItems, loading, error, refetch, saveCost, deleteCost, saving, deleting } = useJobCosts(jobId);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<JobCost | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(freshForm);
  const [amountBasis, setAmountBasis] = useState<'ex' | 'inc'>('ex');
  const [gstAmount, setGstAmount] = useState('0.00');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<JobCost | null>(null);
  const [openingReceipt, setOpeningReceipt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receiptLink, setReceiptLink] = useState<{ url: string; name: string } | null>(null);

  const filtered = useMemo(() => costs.filter(cost =>
    (categoryFilter === 'all' || cost.category === categoryFilter) &&
    (statusFilter === 'all' || cost.status === statusFilter)
  ), [costs, categoryFilter, statusFilter]);
  const totals = useMemo(() => filtered.reduce((acc, cost) => ({ ex: acc.ex + cost.amount_ex_gst, gst: acc.gst + cost.gst_amount, inc: acc.inc + cost.amount_inc_gst }), { ex: 0, gst: 0, inc: 0 }), [filtered]);

  const setAmount = (basis: 'ex' | 'inc', value: string, applies = form.gst_applies) => {
    const number = Number(value);
    const calc = calculateGst(Number.isFinite(number) ? number : 0, basis, applies);
    setAmountBasis(basis);
    setForm(current => ({ ...current, amount_ex_gst: basis === 'ex' ? value : calc.amount_ex_gst.toFixed(2), amount_inc_gst: basis === 'inc' ? value : calc.amount_inc_gst.toFixed(2) }));
    setGstAmount(calc.gst_amount.toFixed(2));
  };
  const startNew = () => { setEditing(null); setForm(freshForm()); setGstAmount('0.00'); setAmountBasis('ex'); setSelectedFile(null); setRemoveReceipt(false); setFormError(''); setFieldErrors({}); setOpen(true); };
  const startEdit = (cost: JobCost) => {
    setEditing(cost); setForm({ supplier: cost.supplier, description: cost.description, cost_date: cost.cost_date, category: cost.category, amount_ex_gst: cost.amount_ex_gst.toFixed(2), amount_inc_gst: cost.amount_inc_gst.toFixed(2), gst_applies: cost.gst_applies, reference_number: cost.reference_number, notes: cost.notes, status: cost.status, quote_line_item_id: cost.quote_line_item_id ?? '', receipt_image_url: cost.receipt_image_url });
    setGstAmount(cost.gst_amount.toFixed(2)); setAmountBasis('ex'); setSelectedFile(null); setRemoveReceipt(false); setFormError(''); setFieldErrors({}); setOpen(true);
  };
  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => ({ ...current, [key]: value }));

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setFormError(''); setFieldErrors({});
    if (!form.amount_ex_gst.trim() || !form.amount_inc_gst.trim()) {
      setFieldErrors({ ...(!form.amount_ex_gst.trim() ? { amount_ex_gst: 'Enter an amount' } : {}), ...(!form.amount_inc_gst.trim() ? { amount_inc_gst: 'Enter an amount' } : {}) });
      setFormError('Enter an amount before saving.'); return;
    }
    const ex = Number(form.amount_ex_gst), inc = Number(form.amount_inc_gst), gst = Number(gstAmount);
    const parsed = jobCostInputSchema.safeParse({
      job_id: jobId, supplier: form.supplier, description: form.description, cost_date: form.cost_date, category: form.category,
      amount_ex_gst: ex, gst_amount: gst, amount_inc_gst: inc, gst_applies: form.gst_applies, reference_number: form.reference_number,
      receipt_image_url: removeReceipt ? null : form.receipt_image_url, status: form.status, notes: form.notes, quote_line_item_id: form.quote_line_item_id || null,
    });
    if (!parsed.success) {
      const flattened: Record<string, string> = {};
      parsed.error.issues.forEach(issue => { const key = String(issue.path[0] ?? 'form'); if (!flattened[key]) flattened[key] = issue.message; });
      setFieldErrors(flattened); setFormError('Check the highlighted fields before saving.'); return;
    }
    setSubmitting(true);
    try {
      let payload: JobCostInput = parsed.data;
      if (selectedFile) payload = { ...payload, receipt_image_url: await uploadCostReceipt(jobId, selectedFile) };
      await saveCost(payload, editing?.id);
      toast.success(editing ? 'Cost updated' : 'Cost added'); setOpen(false);
    } catch (cause) { setFormError(errText(cause)); }
    finally { setSubmitting(false); }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteCost(deleteTarget.id); toast.success('Cost deleted'); setDeleteTarget(null); }
    catch (cause) { toast.error(errText(cause)); }
  };
  const viewReceipt = async (cost: JobCost) => {
    setOpeningReceipt(cost.id);
    try { const url = await getCostReceiptUrl(cost.id); setReceiptLink({ url, name: cost.supplier }); }
    catch (cause) { toast.error(errText(cause)); }
    finally { setOpeningReceipt(null); }
  };

  return (
    <section className="space-y-4" data-testid="job-costs-tab">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="font-heading text-lg font-semibold">Job costs</h2><p className="mt-1 text-sm text-muted-foreground">Record what the job actually costs. Only confirmed costs affect profit.</p></div>
        <Button onClick={startNew} data-testid="button-add-job-cost"><Plus className="mr-2 h-4 w-4" />Add cost</Button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[['Ex GST', totals.ex], ['GST', totals.gst], ['Inc GST', totals.inc]].map(([label, value]) => (
          <Card key={String(label)} className="p-3 sm:p-4"><p className="text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</p><p className="mt-1 truncate text-sm font-bold tabular-nums sm:text-lg">{error ? 'Unavailable' : aud(Number(value))}</p></Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="cost-category-filter" className="text-xs text-muted-foreground">Category</Label>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger id="cost-category-filter" className="h-9 w-[155px]" data-testid="select-cost-category-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{COST_CATEGORIES.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
        <Label htmlFor="cost-status-filter" className="ml-1 text-xs text-muted-foreground">Status</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger id="cost-status-filter" className="h-9 w-[140px]" data-testid="select-cost-status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="draft">Drafts</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem></SelectContent></Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      {error && <Card className="border-amber-300 bg-amber-50/70 p-4"><div className="flex gap-3"><AlertCircle className="h-5 w-5 shrink-0 text-amber-700" /><div className="flex-1"><p className="text-sm font-semibold">Could not load job costs</p><p className="mt-1 text-sm text-muted-foreground">{errText(error)}</p>{isJobCostSetupError(error) && <JobCostSetupHelp />}<Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Retry</Button></div></div></Card>}
      {loading ? <Card className="space-y-3 p-5 animate-pulse"><div className="h-5 w-1/3 rounded bg-muted" /><div className="h-12 rounded bg-muted/70" /><div className="h-12 rounded bg-muted/70" /></Card>
        : filtered.length === 0 && !error ? <Card className="border-dashed px-5 py-10 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800"><FileText className="h-5 w-5" /></div><p className="font-semibold">{costs.length ? 'No costs match this filter' : 'Nothing logged against this job yet'}</p><p className="mt-1 text-sm text-muted-foreground">{costs.length ? 'Choose another category or status.' : 'Add receipts and actual expenses as they come in.'}</p>{!costs.length && <Button className="mt-4" variant="outline" onClick={startNew}><Plus className="mr-2 h-4 w-4" />Add first cost</Button>}</Card>
        : <div className="space-y-2">{filtered.slice().sort((a, b) => b.cost_date.localeCompare(a.cost_date)).map(cost => (
          <Card key={cost.id} className="p-3.5 sm:p-4" data-testid={`job-cost-row-${cost.id}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{cost.supplier}</h3><Badge variant={cost.status === 'confirmed' ? 'success' : 'secondary'}>{cost.status === 'confirmed' ? 'Confirmed' : 'Draft'}</Badge><Badge variant="outline">{cost.category}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{cost.description}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{new Date(`${cost.cost_date}T00:00:00`).toLocaleDateString('en-AU')}</span>{cost.reference_number && <span>Ref {cost.reference_number}</span>}{cost.quote_line_item_id && <span>Linked to quote item</span>}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums"><span>Ex GST <b>{aud(cost.amount_ex_gst)}</b></span><span>GST <b>{aud(cost.gst_amount)}</b></span><span>Inc GST <b>{aud(cost.amount_inc_gst)}</b></span></div>
                {cost.status === 'draft' && <p className="mt-2 text-xs text-amber-800">Draft — excluded from job profit until confirmed.</p>}
                {cost.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{cost.notes}</p>}
                {cost.receipt_image_url && <Button variant="link" size="sm" className="mt-1 h-8 px-0" disabled={openingReceipt === cost.id} onClick={() => viewReceipt(cost)}><Paperclip className="mr-1.5 h-3.5 w-3.5" />{openingReceipt === cost.id ? 'Opening…' : 'View receipt'}</Button>}
              </div>
              <div className="flex shrink-0 gap-1 sm:justify-end"><Button variant="ghost" size="sm" onClick={() => startEdit(cost)} aria-label={`Edit ${cost.supplier}`} data-testid={`button-edit-cost-${cost.id}`}><Pencil className="mr-1.5 h-4 w-4" />Edit</Button><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(cost)} aria-label={`Delete ${cost.supplier}`} data-testid={`button-delete-cost-${cost.id}`}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          </Card>
        ))}</div>}

      {!loading && !error && filtered.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm" data-testid="job-cost-list-totals">
          <span className="font-semibold">Filtered total · {filtered.length} entries</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            <span>Ex GST <b>{aud(totals.ex)}</b></span>
            <span>GST <b>{aud(totals.gst)}</b></span>
            <span>Inc GST <b>{aud(totals.inc)}</b></span>
          </div>
          <p className="w-full text-xs text-muted-foreground">List totals include the selected draft and confirmed entries. Only confirmed entries affect profitability.</p>
        </Card>
      )}

      <Dialog open={open} onOpenChange={next => { if (submitting && !next) return; setOpen(next); }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="dialog-job-cost">
          <DialogHeader><DialogTitle>{editing ? 'Edit job cost' : 'Add a job cost'}</DialogTitle><DialogDescription>Record the actual expense. Use draft while it needs checking; confirmed costs count towards profit.</DialogDescription></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Supplier" id="cost-supplier" error={fieldErrors.supplier}><Input id="cost-supplier" value={form.supplier} maxLength={200} onChange={e => updateForm('supplier', e.target.value)} placeholder="Supplier or crew" required /></Field>
              <Field label="Date" id="cost-date" error={fieldErrors.cost_date}><Input id="cost-date" type="date" value={form.cost_date} onChange={e => updateForm('cost_date', e.target.value)} required /></Field>
            </div>
            <Field label="Description" id="cost-description" error={fieldErrors.description}><Input id="cost-description" value={form.description} maxLength={5000} onChange={e => updateForm('description', e.target.value)} placeholder="What was purchased or done?" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" id="cost-category" error={fieldErrors.category}><Select value={form.category} onValueChange={value => updateForm('category', value as FormState['category'])}><SelectTrigger id="cost-category"><SelectValue /></SelectTrigger><SelectContent>{COST_CATEGORIES.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Status" id="cost-status" error={fieldErrors.status}><Select value={form.status} onValueChange={value => updateForm('status', value as FormState['status'])}><SelectTrigger id="cost-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft — not included in profit</SelectItem><SelectItem value="confirmed">Confirmed — included in profit</SelectItem></SelectContent></Select></Field>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Amounts <span className="text-xs font-normal text-muted-foreground">AUD</span></p><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!form.gst_applies} onChange={e => { const applies = !e.target.checked; updateForm('gst_applies', applies); setAmount(amountBasis, form[amountBasis === 'ex' ? 'amount_ex_gst' : 'amount_inc_gst'], applies); }} className="h-4 w-4 accent-amber-700" />GST-free cost</label></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Ex GST" id="cost-ex" error={fieldErrors.amount_ex_gst}><Input id="cost-ex" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount_ex_gst} onChange={e => setAmount('ex', e.target.value)} /></Field>
                <Field label="GST" id="cost-gst" error={fieldErrors.gst_amount}><Input id="cost-gst" value={gstAmount} readOnly aria-readonly="true" className="bg-muted/60" /><span className="text-[11px] text-muted-foreground">Calculated at 10%</span></Field>
                <Field label="Inc GST" id="cost-inc" error={fieldErrors.amount_inc_gst}><Input id="cost-inc" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount_inc_gst} onChange={e => setAmount('inc', e.target.value)} /></Field>
              </div><p className="mt-2 text-xs text-muted-foreground">Enter either ex-GST or inc-GST; the other amount and GST are calculated.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reference (optional)" id="cost-reference" error={fieldErrors.reference_number}><Input id="cost-reference" maxLength={200} value={form.reference_number} onChange={e => updateForm('reference_number', e.target.value)} placeholder="Invoice or docket number" /></Field>
              <Field label="Link to quote item (optional)" id="cost-quote-link" error={fieldErrors.quote_line_item_id}><Select value={form.quote_line_item_id || 'none'} onValueChange={value => updateForm('quote_line_item_id', value === 'none' ? '' : value)}><SelectTrigger id="cost-quote-link"><SelectValue placeholder="No linked item" /></SelectTrigger><SelectContent><SelectItem value="none">No linked item</SelectItem>{quoteLineItems.map(item => <SelectItem key={item.id} value={item.id}>{item.quote_number} · {item.title}</SelectItem>)}</SelectContent></Select><span className="text-[11px] text-muted-foreground">Quote item is for context only, not an expense estimate.</span></Field>
            </div>
            <Field label="Notes (optional)" id="cost-notes" error={fieldErrors.notes}><Textarea id="cost-notes" maxLength={10000} rows={3} value={form.notes} onChange={e => updateForm('notes', e.target.value)} placeholder="Add a note for your records" /></Field>
            <div className="space-y-2">
              <Label htmlFor="cost-receipt">Receipt attachment (optional)</Label>
              {editing?.receipt_image_url && !removeReceipt && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"><span className="flex items-center gap-2 text-xs"><Paperclip className="h-4 w-4" />Existing receipt attached</span><div className="flex gap-2"><Button type="button" variant="link" size="sm" className="h-7 px-1" disabled={openingReceipt === editing.id} onClick={() => viewReceipt(editing)}>{openingReceipt === editing.id ? 'Loading…' : 'View'}</Button><Button type="button" variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => setRemoveReceipt(true)}>Remove</Button></div></div>}
              {removeReceipt && <p className="text-xs text-amber-800">Existing attachment will be removed when saved. <button type="button" className="underline" onClick={() => setRemoveReceipt(false)}>Undo</button></p>}
              <label htmlFor="cost-receipt" className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 hover:bg-muted/30"><UploadCloud className="h-5 w-5 text-muted-foreground" /><span className="min-w-0 flex-1 text-xs text-muted-foreground">{selectedFile ? selectedFile.name : 'Choose JPEG, PNG, WebP or PDF (max 10 MB)'}</span><span className="text-xs font-semibold text-amber-800">Browse</span></label>
              <input id="cost-receipt" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { const file = e.target.files?.[0] ?? null; setSelectedFile(file); setFormError(''); if (file && !(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type))) setFormError('Use a JPEG, PNG, WebP image or PDF.'); else if (file && (file.size > 10 * 1024 * 1024 || file.size === 0)) setFormError('Choose a receipt smaller than 10 MB.'); }} />
              {selectedFile && <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedFile(null)}>Remove selected file</Button>}
            </div>
            {editing && <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Created {new Date(editing.created_at).toLocaleString('en-AU')} · Updated {new Date(editing.updated_at).toLocaleString('en-AU')} · Creator {editing.created_by}</div>}
            {(formError || Object.keys(fieldErrors).length > 0) && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError || 'Please correct the highlighted fields.'}</p>}
            <DialogFooter className="sticky bottom-[-1px] -mx-1 border-t bg-background/95 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:pt-0"><Button type="button" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving || submitting}>{submitting ? selectedFile ? 'Uploading & saving…' : 'Saving…' : editing ? 'Save changes' : 'Add cost'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!receiptLink} onOpenChange={next => !next && setReceiptLink(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Receipt attachment</DialogTitle><DialogDescription>Private receipt for {receiptLink?.name}. Use the link below to open it in a new tab.</DialogDescription></DialogHeader>
          {receiptLink && <a href={receiptLink.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Open receipt</a>}
          <DialogFooter><Button variant="outline" onClick={() => setReceiptLink(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this cost?</AlertDialogTitle><AlertDialogDescription>This will permanently remove {deleteTarget?.supplier ? `the cost from ${deleteTarget.supplier}` : 'this job cost'} from the job. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? 'Deleting…' : 'Delete cost'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>;
}
