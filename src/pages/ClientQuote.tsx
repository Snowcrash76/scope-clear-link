import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { CheckCircle2, XCircle, FileText, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { ExclusionsPanel } from '@/components/ExclusionsPanel';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import { isVariationItem, stripVariationMeta, cleanVariationTitle } from '@/lib/utils';
import { RichTextContent } from '@/components/RichTextEditor';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionModal, setActionModal] = useState<{
    open: boolean;
    action: 'approve' | 'decline';
  }>({ open: false, action: 'approve' });
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            .eq('status', 'approved'),
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
        headers: { 'Content-Type': 'application/json' },
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

  const fmt = (n: number) =>
    n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const approvedChangeCosts = new Set(changeRequests.map(cr => cr.cost_impact).filter((c): c is number => c !== null));
  // Use is_variation column; fall back to title heuristic for rows not yet migrated
  const isItemVariation = (li: typeof lineItems[number]) =>
    li.is_variation ?? isVariationItem(li.title ?? '');
  const baseLineItems = lineItems.filter(li => !isItemVariation(li) && !approvedChangeCosts.has(li.cost));
  const variationLineItems = lineItems.filter(li => isItemVariation(li));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !quote || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{error ?? 'Quote not found.'}</p>
        </div>
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold" data-testid="text-quote-number">
                {quote.quote_number}
              </h1>
              <p className="text-sm text-muted-foreground">{project.name}</p>
            </div>
          </div>
          <Badge variant={badgeVariant} className="flex-shrink-0 mt-1" data-testid="text-quote-status">
            {statusLabel}
          </Badge>
        </div>

        {/* Business info */}
        {profile && (
          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-3">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={profile.business_name}
                  className="h-10 w-auto object-contain"
                />
              )}
              <div>
                <p className="font-semibold">{profile.business_name}</p>
                {profile.contact_name && (
                  <p className="text-sm text-muted-foreground">{profile.contact_name}</p>
                )}
              </div>
            </div>
            {(profile.business_address || profile.phone || profile.abn) && (
              <div className="text-sm text-muted-foreground space-y-0.5 pt-1">
                {profile.business_address && <p>{profile.business_address}</p>}
                {profile.phone && <p>{profile.phone}</p>}
                {profile.abn && <p>ABN: {profile.abn}</p>}
              </div>
            )}
          </Card>
        )}

        {/* Client info */}
        <Card className="p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Prepared for
          </p>
          <p className="font-semibold" data-testid="text-client-name">
            {project.client_name}
          </p>
          <p className="text-sm text-muted-foreground">{project.client_email}</p>
          {project.client_address && (
            <p className="text-sm text-muted-foreground">{project.client_address}</p>
          )}
        </Card>

        {/* Validity */}
        {quote.valid_until && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              Valid until{' '}
              <span className="font-medium text-foreground">
                {format(new Date(quote.valid_until), 'dd MMM yyyy')}
              </span>
            </span>
          </div>
        )}

        {/* Line items — base items only (variation duplicates excluded) */}
        {baseLineItems.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b bg-secondary/30">
              <h2 className="font-heading font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Included Items
              </h2>
            </div>
            <div className="divide-y">
              {baseLineItems.map((li) => (
                <div key={li.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium" data-testid={`text-line-item-title-${li.id}`}>
                      {li.title}
                    </p>
                    {stripVariationMeta(li.description) && (
                      <RichTextContent html={stripVariationMeta(li.description)} className="mt-0.5" />
                    )}
                  </div>
                  <p className="font-medium whitespace-nowrap tabular-nums">${fmt(li.cost)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Approved Variations — separate green section */}
        {variationLineItems.length > 0 && (
          <Card className="overflow-hidden border-approved/30">
            <div className="px-4 py-3 border-b bg-approved/5">
              <h2 className="font-heading font-semibold text-sm uppercase tracking-wide text-approved">
                Approved Variations
              </h2>
            </div>
            <div className="divide-y divide-approved/10">
              {variationLineItems.map((li) => (
                <div key={li.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium" data-testid={`text-variation-title-${li.id}`}>
                      {li.title}
                    </p>
                    {li.description && (
                      <RichTextContent html={li.description} className="mt-0.5" />
                    )}
                  </div>
                  <p className="font-medium whitespace-nowrap tabular-nums text-approved">
                    +${fmt(li.cost)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Totals */}
        <Card className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums" data-testid="text-quote-subtotal">
              ${fmt(subtotal)}
            </span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST ({taxRate}%)</span>
              <span className="tabular-nums">${fmt(taxAmount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg pt-1">
            <span>Total</span>
            <span className="tabular-nums" data-testid="text-quote-total">
              ${fmt(total)}
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

        {/* Client's own comment */}
        {quote.client_comment && !isActionable && (
          <Card className="p-4 bg-secondary/40 border-dashed">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Your comment
            </p>
            <p className="text-sm">{quote.client_comment}</p>
          </Card>
        )}

        {/* Status banners */}
        {quote.status === 'approved' && (
          <div
            className="flex items-center gap-3 p-4 rounded-lg bg-approved/10 border border-approved/20"
            data-testid="status-quote-approved"
          >
            <CheckCircle2 className="w-5 h-5 text-approved flex-shrink-0" />
            <div>
              <p className="font-semibold text-approved">Quote accepted</p>
              {quote.approved_at && (
                <p className="text-sm text-muted-foreground">
                  {format(new Date(quote.approved_at), "dd MMM yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
          </div>
        )}

        {quote.status === 'declined' && (
          <div
            className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20"
            data-testid="status-quote-declined"
          >
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Quote declined</p>
              {quote.declined_at && (
                <p className="text-sm text-muted-foreground">
                  {format(new Date(quote.declined_at), "dd MMM yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isActionable && (
          <div className="flex gap-3">
            <Button
              variant="decline"
              className="flex-1"
              onClick={() => setActionModal({ open: true, action: 'decline' })}
              data-testid="button-decline-quote"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Decline
            </Button>
            <Button
              variant="approve"
              className="flex-1"
              onClick={() => setActionModal({ open: true, action: 'approve' })}
              data-testid="button-accept-quote"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Accept Quote
            </Button>
          </div>
        )}
      </div>

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
        <DialogContent>
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
