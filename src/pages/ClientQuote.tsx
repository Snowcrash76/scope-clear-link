import { useState, useEffect } from 'react';
import { ClientChangeRequest } from '@/components/client/ClientChangeRequest';
import { useProject } from '@/hooks/useProject';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { clientAccessHeaders } from '@/lib/clientAccess';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, XCircle, FileText, Loader2, AlertCircle, Calendar, Clock, Download, Mail, Phone, ChevronDown } from 'lucide-react';
import { useLineItemHistory, formatHistoryEntry } from '@/hooks/useLineItemHistory';
import { ExclusionsPanel } from '@/components/ExclusionsPanel';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import { isVariationItem, stripVariationMeta, cleanVariationTitle } from '@/lib/utils';
import { RichTextContent } from '@/components/RichTextEditor';
import { aud } from '@/hooks/useJobCosts';
import { ClientPortalHeader } from '@/components/client/ClientPortalHeader';
import { downloadQuotePDF } from '@/lib/quotePdf';
import type { ChangeRequest, Quote as ProjectQuote, QuoteLineItem, ScopeItem } from '@/types/project';

type QuoteRow = Database['public']['Tables']['quotes']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type QuoteLineItemRow = Database['public']['Tables']['quote_line_items']['Row'];
type ChangeRequestRow = Database['public']['Tables']['change_requests']['Row'];
type ScopeItemRow = Database['public']['Tables']['scope_items']['Row'];

export default function ClientQuote() {
  const { token } = useParams<{ token: string }>();

  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [lineItems, setLineItems] = useState<QuoteLineItemRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequestRow[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItemRow[]>([]);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const { createChangeRequest } = useProject(project?.id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    history: lineItemHistory,
    changeRequests: activityChangeRequests,
    quote: activityQuote,
  } = useLineItemHistory(quote?.id, token ?? undefined);
  const [expandedHistoryItemId, setExpandedHistoryItemId] = useState<string | null>(null);

  const [actionModal, setActionModal] = useState<{
    open: boolean;
    action: 'approve' | 'decline';
  }>({ open: false, action: 'approve' });
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<'included' | 'variations', boolean>>(() => ({
    included: typeof window !== 'undefined' && window.innerWidth >= 640,
    variations: typeof window !== 'undefined' && window.innerWidth >= 640,
  }));

  useEffect(() => {
    if (!token) return;

    async function load() {
      try {
        setLoading(true);

        const { data: quoteRow, error: quoteErr } = await supabase
          .from('quotes')
          .select('*')
          .eq('quote_token', token as string)
          .single();

        if (quoteErr || !quoteRow) {
          setError('Quote not found. The link may be invalid or expired.');
          return;
        }

        setQuote(quoteRow);

        const [lineItemsRes, projectRes, changeRequestsRes, scopeItemsRes] = await Promise.all([
          supabase
            .from('quote_line_items')
            .select('*')
            .eq('quote_id', quoteRow.id)
            .order('sort_order', { ascending: true }),
          supabase
            .from('projects')
            .select('*')
            .eq('id', quoteRow.project_id)
            .single(),
          supabase
            .from('change_requests')
            .select('*')
            .eq('project_id', quoteRow.project_id)
            .order('created_at', { ascending: true }),
          supabase
            .from('scope_items')
            .select('*')
            .eq('project_id', quoteRow.project_id)
            .order('created_at', { ascending: true }),
        ]);

        if (lineItemsRes.data) {
          setLineItems(lineItemsRes.data);
        }

        if (changeRequestsRes.data) {
          setChangeRequests(changeRequestsRes.data);
        }

        if (scopeItemsRes.data) {
          setScopeItems(scopeItemsRes.data);
        }

        if (projectRes.data) {
          setProject(projectRes.data);

          const { data: profileRow } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', projectRes.data.user_id)
            .single();

          if (profileRow) {
            setProfile(profileRow);
          }
        }
      } catch (err) {
        console.error('Error loading quote:', err);
        setError('Failed to load the quote. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  const handleRespond = async () => {
    if (!quote || !token) return;
    setIsSubmitting(true);
    try {
      const isApprove = actionModal.action === 'approve';

      const { data: success, error: rpcErr } = await supabase.rpc(
        'respond_to_quote_by_token',
        {
          p_token: token,
          p_status: isApprove ? 'approved' : 'declined',
          p_comment: comment.trim() || null,
        }
      );

      if (rpcErr) throw rpcErr;

      if (!success) {
        toast.error(
          'Unable to submit your response. The quote may have already been actioned.'
        );
        return;
      }

      setQuote((prev) =>
        prev
          ? {
              ...prev,
              status: isApprove ? 'approved' : 'declined',
              approved_at: isApprove ? new Date().toISOString() : prev.approved_at,
              declined_at: !isApprove ? new Date().toISOString() : prev.declined_at,
              client_comment: comment.trim() || prev.client_comment,
            }
          : null
      );

      toast.success(isApprove ? 'Quote accepted!' : 'Quote declined');
      setActionModal({ open: false, action: 'approve' });
      setComment('');

      fetch('/api/send-quote-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...clientAccessHeaders() },
        body: JSON.stringify({
          quoteToken: token,
          notificationType: isApprove ? 'approved' : 'declined',
        }),
      }).catch((err) => {
        console.error('Failed to send quote notification email:', err);
      });
    } catch (err) {
      console.error('Error responding to quote:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approvedChangeCosts = new Set(changeRequests.filter(cr => cr.status === 'approved').map(cr => cr.cost_impact).filter((c): c is number => c !== null));
  // Use is_variation column; fall back to title heuristic for rows not yet migrated
  const isItemVariation = (li: typeof lineItems[number]) =>
    li.is_variation ?? isVariationItem(li.title ?? '');
  const baseLineItems = lineItems.filter(li => !isItemVariation(li) && !approvedChangeCosts.has(li.cost));
  const variationLineItems = lineItems.filter(li => isItemVariation(li));
  const quoteGroups = [
    ...(baseLineItems.length ? ['included' as const] : []),
    ...(variationLineItems.length ? ['variations' as const] : []),
  ];
  const allGroupsExpanded = quoteGroups.length > 0 && quoteGroups.every(group => expandedGroups[group]);
  const toggleAllGroups = () => setExpandedGroups({
    included: quoteGroups.length > 0 && !allGroupsExpanded && quoteGroups.includes('included'),
    variations: quoteGroups.length > 0 && !allGroupsExpanded && quoteGroups.includes('variations'),
  });

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-muted/20 px-4 py-8" aria-label="Loading quote">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !quote || !project) {
    return (
      <div className="min-h-[100dvh] bg-muted/20 px-4 py-10">
        <Card className="mx-auto max-w-lg border-border bg-card p-6 sm:p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quote link unavailable</p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">We couldn’t open this quote</h1>
          <p role="alert" className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {error ?? 'The link may be invalid or no longer active.'}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If this quote arrived by email, reply to that original message to reach the business. We can’t safely show contact details until the quote is loaded.
          </p>
        </Card>
      </div>
    );
  }

  const subtotal = quote.subtotal ?? 0;
  const taxRate = quote.tax_rate ?? 0;
  const taxAmount = quote.tax_amount ?? 0;
  const total = quote.total ?? 0;

  const isActionable = quote.status === 'sent';

  const badgeVariant =
    quote.status === 'approved'
      ? 'success'
      : quote.status === 'declined'
      ? 'destructive'
      : ('pending' as const);

  const statusLabel =
    quote.status === 'approved'
      ? 'Accepted'
      : quote.status === 'declined'
      ? 'Declined'
      : quote.status === 'draft'
      ? 'Draft'
      : quote.status === 'revised'
      ? 'Revised'
      : 'Pending your response';

  const logoUrl =
    profile?.logo_url &&
    (profile.logo_url.startsWith('data:') || profile.logo_url.startsWith('https://'))
      ? profile.logo_url
      : null;
  const validityDate = quote.valid_until ? new Date(quote.valid_until) : null;
  const validityPassed = !!validityDate && validityDate.getTime() < Date.now();
  const quotePdf: ProjectQuote = {
    id: quote.id,
    projectId: quote.project_id,
    quoteNumber: quote.quote_number,
    reference: undefined,
    quoteToken: quote.quote_token ?? undefined,
    status: quote.status as ProjectQuote['status'],
    subtotal,
    taxRate,
    taxAmount,
    total,
    validUntil: validityDate ?? undefined,
    notes: quote.notes ?? undefined,
    terms: quote.terms ?? undefined,
    clientComment: quote.client_comment ?? undefined,
    approvedAt: quote.approved_at ? new Date(quote.approved_at) : undefined,
    declinedAt: quote.declined_at ? new Date(quote.declined_at) : undefined,
    createdAt: new Date(quote.created_at),
    updatedAt: new Date(quote.updated_at),
  };
  const quotePdfScope: ScopeItem[] = scopeItems.map(item => ({
    id: item.id,
    title: item.title,
    description: item.description ?? '',
    category: item.category as ScopeItem['category'],
    acknowledged: item.acknowledged,
    cost: item.cost ?? undefined,
    imageUrl: item.image_url ?? undefined,
    imageUrls: item.image_urls ?? undefined,
  }));
  const quotePdfChanges: ChangeRequest[] = changeRequests.map(change => ({
    id: change.id,
    type: change.type as ChangeRequest['type'],
    relatedScopeItemId: change.related_scope_item_id ?? undefined,
    relatedQuoteLineItemId: change.related_quote_line_item_id ?? undefined,
    title: change.title,
    description: change.description,
    reason: change.reason ?? undefined,
    costImpact: change.cost_impact ?? 0,
    timeImpact: Number(change.time_impact) || 0,
    status: change.status as ChangeRequest['status'],
    createdAt: new Date(change.created_at),
    resolvedAt: change.resolved_at ? new Date(change.resolved_at) : undefined,
    imageUrl: change.image_url ?? undefined,
    resolutionComment: change.resolution_comment ?? undefined,
  }));
  const quotePdfItems: QuoteLineItem[] = lineItems.map(item => ({
    id: item.id,
    quoteId: item.quote_id,
    title: item.title,
    description: item.description ?? undefined,
    cost: item.cost,
    sortOrder: item.sort_order,
    isVariation: isItemVariation(item),
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  }));

  const handleDownloadPdf = async () => {
    try {
      await downloadQuotePDF(
        quotePdf,
        {
          name: project.name,
          clientName: project.client_name,
          clientEmail: project.client_email,
          clientAddress: project.client_address ?? undefined,
          tradeBusinessName: profile?.business_name ?? undefined,
          tradeName: profile?.contact_name ?? undefined,
          tradeAddress: profile?.business_address ?? undefined,
          tradePhone: profile?.phone ?? undefined,
          tradeWebsite: profile?.website ?? undefined,
          abn: profile?.abn ?? undefined,
        },
        quotePdfScope,
        quotePdfChanges,
        quotePdfItems,
        logoUrl ?? undefined,
      );
      toast.success('Quote PDF downloaded');
    } catch {
      toast.error('Could not download the quote PDF. Please try again.');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-muted/20 pb-24 sm:pb-10">
      <ClientPortalHeader
        businessName={profile?.business_name ?? 'Your project team'}
        projectName={project.name}
        clientName={project.client_name}
        statusLabel={statusLabel}
        statusVariant={badgeVariant}
        logoUrl={logoUrl}
        referenceLabel={`Quote ${quote.quote_number}`}
        createdAt={quote.created_at}
      />
      <main className="mx-auto w-full min-w-0 max-w-3xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">
        <Card className="min-w-0 overflow-hidden border-primary/20 bg-card shadow-sm" data-testid="client-quote-summary">
          <div className="border-b border-border bg-primary/5 px-4 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">Quote summary</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground sm:text-2xl">
              {isActionable ? 'Review your quote' : quote.status === 'approved' ? 'Your accepted quote' : quote.status === 'declined' ? 'Your quote decision' : 'Quote details'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {isActionable ? 'Review the work and pricing below, then let the business know how you would like to proceed.' : `Quote ${quote.quote_number} for ${project.name}.`}
            </p>
          </div>
          <div className="space-y-4 px-4 py-4 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-sm text-muted-foreground">Subtotal (ex GST)</p>
                <p className="mt-1 break-words font-semibold tabular-nums text-foreground">{aud(subtotal)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-sm text-muted-foreground">GST ({taxRate}%)</p>
                <p className="mt-1 break-words font-semibold tabular-nums text-foreground">{aud(taxAmount)}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:col-span-1">
                <p className="text-sm font-medium text-muted-foreground">Total (inc GST)</p>
                <p className="mt-1 break-words font-heading text-xl font-bold tabular-nums text-foreground">{aud(total)}</p>
              </div>
            </div>
            {validityDate && (
              <div className="flex items-start gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">Listed validity: {format(validityDate, 'dd MMM yyyy')}</p>
                  {validityPassed && (
                    <p className="mt-0.5 text-muted-foreground">
                      This date has passed, but the quote is still marked pending. This page does not block a response based on the date; contact the business to confirm pricing is current.
                    </p>
                  )}
                </div>
              </div>
            )}
            {isActionable && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="approve"
                  className="min-h-11 flex-1"
                  onClick={() => setActionModal({ open: true, action: 'approve' })}
                  data-testid="button-accept-quote-top"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Accept quote
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11 sm:min-w-32"
                  onClick={() => setActionModal({ open: true, action: 'decline' })}
                  data-testid="button-decline-quote-top"
                >
                  <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Decline
                </Button>
              </div>
            )}
            {isActionable && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Need an adjustment? {profile?.email ? (
                  <a className="font-medium text-foreground underline underline-offset-4" href={`mailto:${profile.email}?subject=${encodeURIComponent(`Question about quote ${quote.quote_number}`)}`}>
                    Email {profile.business_name || 'the business'}
                  </a>
                ) : profile?.phone ? (
                  <a className="font-medium text-foreground underline underline-offset-4" href={`tel:${profile.phone}`}>
                    Call {profile.business_name || 'the business'}
                  </a>
                ) : (
                  <span>Reply to the original quote email to contact the business.</span>
                )}
              </p>
            )}
          </div>
        </Card>

        {(quote.status === 'approved' || quote.status === 'declined') && (
          <Card
            className={quote.status === 'approved' ? 'border-approved/25 bg-approved/5 p-4 sm:p-5' : 'border-destructive/25 bg-destructive/5 p-4 sm:p-5'}
            data-testid="persistent-quote-decision"
            aria-live="polite"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${quote.status === 'approved' ? 'text-approved' : 'text-destructive'}`}>
                  Decision recorded: you {quote.status === 'approved' ? 'accepted' : 'declined'} Quote {quote.quote_number}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(quote.status === 'approved' ? quote.approved_at : quote.declined_at)
                    ? format(new Date((quote.status === 'approved' ? quote.approved_at : quote.declined_at)!), "dd MMM yyyy 'at' h:mm a")
                    : 'The decision is saved to this quote.'}
                </p>
                {quote.client_comment && <p className="mt-2 break-words text-sm text-foreground">Your note: {quote.client_comment}</p>}
              </div>
              <Button variant="outline" className="min-h-11 shrink-0" onClick={handleDownloadPdf}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
            </div>
          </Card>
        )}

        {profile && (profile.contact_name || profile.business_address || profile.phone || profile.abn) && (
          <Card className="min-w-0 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Business contact</p>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {profile.contact_name && <p className="break-words [overflow-wrap:anywhere] font-semibold">{profile.contact_name}</p>}
                {profile.business_address && <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm text-muted-foreground">{profile.business_address}</p>}
                {profile.abn && <p className="mt-1 text-sm text-muted-foreground">ABN: {profile.abn}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.phone && (
                  <a className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted" href={`tel:${profile.phone}`}>
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Call
                  </a>
                )}
                {profile.email && (
                  <a className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted" href={`mailto:${profile.email}`}>
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Email
                  </a>
                )}
              </div>
            </div>
          </Card>
        )}

        {(project.client_email || project.client_address) && (
          <Card className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Project details</p>
            {project.client_email && <p className="break-words [overflow-wrap:anywhere] text-sm text-muted-foreground">{project.client_email}</p>}
            {project.client_address && <p className="break-words [overflow-wrap:anywhere] text-sm text-muted-foreground">{project.client_address}</p>}
          </Card>
        )}

        <section className="space-y-3" aria-labelledby="quote-work-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="quote-work-heading" className="font-heading text-xl font-bold text-foreground">Quoted work</h2>
              <p className="mt-1 text-sm text-muted-foreground">Grouped by the categories available on this quote.</p>
            </div>
            {quoteGroups.length > 0 && (
              <Button variant="outline" className="min-h-11" onClick={toggleAllGroups} aria-label={allGroupsExpanded ? 'Collapse all quote categories' : 'Expand all quote categories'}>
                <ChevronDown className={`mr-2 h-4 w-4 transition-transform ${allGroupsExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                {allGroupsExpanded ? 'Collapse all' : 'Expand all'}
              </Button>
            )}
          </div>
          {quoteGroups.length === 0 ? (
            <Card className="border-dashed p-5">
              <p className="font-medium text-foreground">No itemized work on this quote</p>
              <p className="mt-1 text-sm text-muted-foreground">The quoted amount is shown in the summary and totals.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {baseLineItems.length > 0 && (
                <Card className="min-w-0 overflow-hidden">
                  <button
                    type="button"
                    className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 sm:px-5"
                    aria-expanded={expandedGroups.included}
                    onClick={() => setExpandedGroups(current => ({ ...current, included: !current.included }))}
                  >
                    <span className="min-w-0">
                      <span className="block font-heading font-semibold text-foreground">Included work</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{baseLineItems.length} {baseLineItems.length === 1 ? 'item' : 'items'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-right">
                        <span className="block text-xs text-muted-foreground">Category subtotal</span>
                        <span className="block font-semibold tabular-nums text-foreground">{aud(baseLineItems.reduce((sum, item) => sum + item.cost, 0))}</span>
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedGroups.included ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </span>
                  </button>
                  {expandedGroups.included && <div className="divide-y border-t">
              {baseLineItems.map((li) => {
                const itemHistory = lineItemHistory.filter(h => h.lineItemId === li.id);
                const isExpanded = expandedHistoryItemId === li.id;
                return (
                  <div key={li.id}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="break-words [overflow-wrap:anywhere] font-medium" data-testid={`text-line-item-title-${li.id}`}>
                            {li.title}
                          </p>
                          {itemHistory.length > 0 && (
                              <button
                               type="button"
                              onClick={() => setExpandedHistoryItemId(isExpanded ? null : li.id)}
                               className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
                               aria-label={`View ${itemHistory.length} changes to ${li.title}`}
                              title={`${itemHistory.length} change${itemHistory.length !== 1 ? 's' : ''}`}
                              data-testid={`button-history-${li.id}`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {stripVariationMeta(li.description) && (
                          <RichTextContent html={stripVariationMeta(li.description)} className="mt-0.5" />
                        )}
                      </div>
                      <p className="font-medium whitespace-nowrap tabular-nums sm:self-start">{aud(li.cost)}</p>
                    </div>
                    {isExpanded && itemHistory.length > 0 && (
                      <div className="mx-4 mb-3 rounded-md bg-muted/30 border divide-y text-sm">
                        {[...itemHistory].reverse().map(h => (
                          <div key={h.id} className="px-3 py-2 flex items-start gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div>
                              <p>{formatHistoryEntry(h)}</p>
                              <p className="text-muted-foreground mt-0.5">
                                {h.createdAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {' at '}
                                {h.createdAt.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
                  </div>}
                </Card>
              )}

        {/* Approved Variations — separate green section */}
        {variationLineItems.length > 0 && (
          <Card className="min-w-0 overflow-hidden border-approved/30">
            <button
              type="button"
              className="flex min-h-16 w-full items-center justify-between gap-3 bg-approved/5 px-4 py-3 text-left hover:bg-approved/10 sm:px-5"
              aria-expanded={expandedGroups.variations}
              onClick={() => setExpandedGroups(current => ({ ...current, variations: !current.variations }))}
            >
              <span className="min-w-0">
                <span className="block font-heading font-semibold text-approved">Approved variations</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{variationLineItems.length} {variationLineItems.length === 1 ? 'item' : 'items'}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-right">
                  <span className="block text-xs text-muted-foreground">Category subtotal</span>
                  <span className="block font-semibold tabular-nums text-approved">{aud(variationLineItems.reduce((sum, item) => sum + item.cost, 0))}</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-approved transition-transform ${expandedGroups.variations ? 'rotate-180' : ''}`} aria-hidden="true" />
              </span>
            </button>
            {expandedGroups.variations && <div className="divide-y divide-approved/10 border-t border-approved/20">
              {variationLineItems.map((li) => {
                const itemHistory = lineItemHistory.filter(h => h.lineItemId === li.id);
                const isExpanded = expandedHistoryItemId === li.id;
                return (
                  <div key={li.id}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="break-words [overflow-wrap:anywhere] font-medium" data-testid={`text-variation-title-${li.id}`}>
                            {li.title}
                          </p>
                          {itemHistory.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedHistoryItemId(isExpanded ? null : li.id)}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-approved/60 hover:bg-approved/10 hover:text-approved transition-colors flex-shrink-0"
                              aria-label={`View ${itemHistory.length} changes to ${li.title}`}
                              title={`${itemHistory.length} change${itemHistory.length !== 1 ? 's' : ''}`}
                              data-testid={`button-history-${li.id}`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {li.description && (
                          <RichTextContent html={li.description} className="mt-0.5" />
                        )}
                      </div>
                      <p className="font-medium whitespace-nowrap tabular-nums text-approved sm:self-start">
                        +{aud(li.cost)}
                      </p>
                    </div>
                    {isExpanded && itemHistory.length > 0 && (
                      <div className="mx-4 mb-3 rounded-md bg-muted/30 border divide-y text-sm">
                        {[...itemHistory].reverse().map(h => (
                          <div key={h.id} className="px-3 py-2 flex items-start gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div>
                              <p>{formatHistoryEntry(h)}</p>
                              <p className="text-muted-foreground mt-0.5">
                                {h.createdAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {' at '}
                                {h.createdAt.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>}
          </Card>
        )}
            </div>
          )}
        </section>

        {/* Totals */}
        <Card className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal (ex GST)</span>
            <span className="tabular-nums" data-testid="text-quote-subtotal">
              {aud(subtotal)}
            </span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST ({taxRate}%)</span>
              <span className="tabular-nums">{aud(taxAmount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg pt-1">
            <span>Total (inc GST)</span>
            <span className="tabular-nums" data-testid="text-quote-total">
              {aud(total)}
            </span>
          </div>
        </Card>

        {/* Notes */}
        {quote.notes && (
          <Card className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>
            <RichTextContent html={quote.notes} />
          </Card>
        )}

        {/* Exclusions & Assumptions */}
        {(() => {
          const excluded = scopeItems.filter(i => i.category === 'excluded');
          const assumptions = scopeItems.filter(i => i.category === 'assumption');
          if (excluded.length === 0 && assumptions.length === 0) return null;
          return (
            <ExclusionsPanel
              excludedItems={excluded.map(i => ({ id: i.id, title: i.title, description: i.description ?? '' }))}
              assumptionItems={assumptions.map(i => ({ id: i.id, title: i.title, description: i.description ?? '' }))}
            />
          );
        })()}

        {/* Terms */}
        {quote.terms && (
          <Card className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terms & Conditions</p>
            <RichTextContent html={quote.terms} />
          </Card>
        )}

        {/* Status banners */}
        {quote.status === 'revised' && (
          <div
            className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
            data-testid="status-quote-revised"
          >
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300">Quote has been updated</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                Your tradesperson has made changes to this quote. You will be notified when your approval is required.
              </p>
            </div>
          </div>
        )}
        <ClientChangeRequest onSubmit={description => createChangeRequest({
          type: 'client_request',
          title: 'Client Request',
          description,
          costImpact: 0,
          timeImpact: 0,
        }, 'trade')} />

        {/* Unified activity feed — line item history + change requests + quote status events
            Data is sourced from the hook's unified endpoint response ({ history, changeRequests, quote })
            with a fallback to the locally-loaded quote for quote status events if the hook hasn't resolved yet. */}
        {(() => {
          const aq = activityQuote;
          const quoteEvents = aq ? [
            { kind: 'quoteEvent' as const, id: 'qe-created', timestamp: aq.createdAt, label: 'Quote issued' },
            ...(aq.approvedAt ? [{ kind: 'quoteEvent' as const, id: 'qe-approved', timestamp: aq.approvedAt, label: 'Quote accepted' }] : []),
            ...(aq.declinedAt ? [{ kind: 'quoteEvent' as const, id: 'qe-declined', timestamp: aq.declinedAt, label: 'Quote declined' }] : []),
          ] : (quote ? [
            { kind: 'quoteEvent' as const, id: 'qe-created', timestamp: new Date(quote.created_at), label: 'Quote issued' },
            ...(quote.approved_at ? [{ kind: 'quoteEvent' as const, id: 'qe-approved', timestamp: new Date(quote.approved_at), label: 'Quote accepted' }] : []),
            ...(quote.declined_at ? [{ kind: 'quoteEvent' as const, id: 'qe-declined', timestamp: new Date(quote.declined_at), label: 'Quote declined' }] : []),
          ] : []);
          const feed = [
            ...quoteEvents,
            ...activityChangeRequests.map(cr => ({
              kind: 'changeRequest' as const,
              id: `cr-${cr.id}`,
              timestamp: cr.resolvedAt ?? cr.createdAt,
              label: cr.title,
              status: cr.status,
            })),
            ...lineItemHistory.map(h => ({
              kind: 'lineItem' as const,
              id: `li-${h.id}`,
              timestamp: h.createdAt,
              label: formatHistoryEntry(h),
            })),
          ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

          if (feed.length === 0) return null;

          return (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b bg-secondary/30">
                <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Activity</h2>
              </div>
              <div className="divide-y">
                {feed.map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                    {item.kind === 'quoteEvent'
                      ? <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      : <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {item.timestamp.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' at '}
                        {item.timestamp.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })()}

        {/* Action buttons */}
        {isActionable && (
          <div className="hidden gap-3 sm:flex">
            <Button
              variant="decline"
              className="min-h-11 flex-1"
              onClick={() => setActionModal({ open: true, action: 'decline' })}
              data-testid="button-decline-quote"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Decline
            </Button>
            <Button
              variant="approve"
              className="min-h-11 flex-1"
              onClick={() => setActionModal({ open: true, action: 'approve' })}
              data-testid="button-accept-quote"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Accept Quote
            </Button>
          </div>
        )}
      </main>

      {isActionable && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-8px_24px_rgba(28,67,113,0.10)] backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Button variant="outline" className="min-h-11 flex-1" onClick={() => setActionModal({ open: true, action: 'decline' })}>
              Decline
            </Button>
            <Button variant="approve" className="min-h-11 flex-[1.3]" onClick={() => setActionModal({ open: true, action: 'approve' })}>
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Accept
            </Button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog
        open={actionModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setActionModal((p) => ({ ...p, open: false }));
            setComment('');
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionModal.action === 'approve' ? 'Accept this quote?' : 'Decline this quote?'}
            </DialogTitle>
            <DialogDescription>
              {actionModal.action === 'approve'
                ? 'By accepting, you agree to proceed with the quoted work. The tradesperson will be notified.'
                : 'Let the tradesperson know you are declining this quote.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="client-comment">
              {actionModal.action === 'approve' ? 'Add a comment (optional)' : 'Reason (optional)'}
            </Label>
            <Textarea
              id="client-comment"
              placeholder={
                actionModal.action === 'approve'
                  ? 'e.g. Happy to proceed — please get in touch to confirm the start date.'
                  : 'e.g. The price is a bit high — can we discuss?'
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              data-testid="input-client-comment"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionModal((p) => ({ ...p, open: false }));
                setComment('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={actionModal.action === 'approve' ? 'approve' : 'decline'}
              onClick={handleRespond}
              disabled={isSubmitting}
              data-testid="button-confirm-response"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : actionModal.action === 'approve' ? (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              {actionModal.action === 'approve' ? 'Accept Quote' : 'Decline Quote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
