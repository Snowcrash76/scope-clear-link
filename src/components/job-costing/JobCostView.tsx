import { useEffect, useState } from 'react';
import { getCostReceiptUrl, type JobCost } from '@/hooks/useJobCosts';
import { Button } from '@/components/ui/button';
import { ReceiptItemsSummary } from './ReceiptItemsSummary';

export function JobCostView({ cost }: { cost: JobCost }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setUrl(''); setError(''); setImageFailed(false);
    if (!cost.receipt_image_url) { setLoading(false); return; }
    setLoading(true);
    getCostReceiptUrl(cost.id).then(result => {
      if (active) {
        if (result) setUrl(result);
        else setError('The receipt link could not be loaded.');
      }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load the original receipt.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cost.id, cost.receipt_image_url, retry]);

  return <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]" data-testid="job-cost-read-only">
    <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
      {[
        ['Supplier', cost.supplier], ['Date', new Date(`${cost.cost_date}T00:00:00`).toLocaleDateString('en-AU')],
        ['Reference', cost.reference_number || 'Not recorded'], ['Category', cost.category],
        ['Status', cost.status === 'confirmed' ? 'Confirmed' : 'Draft'],
        ['Supplier ABN', cost.receipt_abn || 'Not recorded'],
      ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
    </dl>
    <div><h3 className="text-xs text-muted-foreground">Description</h3><p className="mt-1 whitespace-pre-wrap text-sm">{cost.description}</p></div>
    <ReceiptItemsSummary items={cost.receipt_line_items ?? []} subtotal={cost.amount_ex_gst} gst={cost.gst_amount} total={cost.amount_inc_gst} />
    {cost.notes && <div><h3 className="text-xs text-muted-foreground">Notes</h3><p className="mt-1 whitespace-pre-wrap text-sm">{cost.notes}</p></div>}
    <section aria-label="Original receipt" className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold">Original receipt</h3>
      {!cost.receipt_image_url && <p className="text-sm text-muted-foreground">No receipt attached.</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading receipt…</p>}
      {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Retry receipt</Button></div>}
      {url && <>
        {!/\.pdf(?:$|[?#])/i.test(cost.receipt_image_url ?? '') && !imageFailed &&
          <img src={url} alt={`Original receipt from ${cost.supplier}`} className="block max-h-96 w-full min-w-0 max-w-full rounded border object-contain" onError={() => setImageFailed(true)} />}
        {imageFailed && <p className="text-xs text-muted-foreground">Preview unavailable. Open the original attachment using the link below.</p>}
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium underline" data-testid="link-original-receipt">Open original receipt</a>
      </>}
    </section>
  </div>;
}
