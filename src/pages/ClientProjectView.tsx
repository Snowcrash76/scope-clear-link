import { variationItemTitle } from '@/lib/variationItems';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ActionRequired } from '@/components/ActionRequired';
import { ExclusionsPanel } from '@/components/ExclusionsPanel';
import { ChangeRequestCard } from '@/components/ChangeRequestCard';
import { ProjectTimeline } from '@/components/ProjectTimeline';
import { RequestChangeButton } from '@/components/RequestChangeButton';
import { ClientDocumentsSection } from '@/components/ClientDocumentsSection';
import { ApprovalModal } from '@/components/ApprovalModal';
import { QuoteViewModal } from '@/components/QuoteViewModal';
import { InvoiceViewModal } from '@/components/InvoiceViewModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/hooks/useProject';
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuoteLineItems } from '@/hooks/useQuoteLineItems';
import { useLineItemHistory, formatHistoryEntry } from '@/hooks/useLineItemHistory';
import { toast } from 'sonner';
import { RefreshCw, TrendingUp, FileText, Loader2, Calculator, Download, Eye, Receipt, FolderOpen, CheckCircle2, X, Clock } from 'lucide-react';
import { downloadQuotePDF } from '@/lib/quotePdf';
import { downloadInvoicePDF } from '@/lib/invoicePdf';
import { Invoice, ScopeItem } from '@/types/project';
import { cn, isVariationItem, stripVariationMeta } from '@/lib/utils';
import { RichTextContent } from '@/components/RichTextEditor';

export default function ClientProjectView() {
  const { id } = useParams();
  const {
    project,
    documents,
    loading,
    refetch: refetchProject,
    createChangeRequest,
    updateChangeRequestStatus,
  } = useProject(id);
  
  const { activeQuote, refetch: refetchQuotes } = useQuotes(id);
  const { invoices, loading: invoicesLoading } = useInvoices(id);
  const { lineItems: quoteLineItems } = useQuoteLineItems(activeQuote?.id);
  const { history: lineItemHistory } = useLineItemHistory(activeQuote?.id, activeQuote?.quoteToken ?? undefined);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Move useState to top before any conditional returns (React hooks rule)
  // Tracks IDs that the client has already approved/declined optimistically
  // (before the server round-trip completes). Stored in the parent so it
  // survives any child re-renders or reconciliations.
  const [optimisticApprovedIds, setOptimisticApprovedIds] = useState<Set<string>>(new Set());
  const [optimisticDeclinedIds, setOptimisticDeclinedIds] = useState<Set<string>>(new Set());
  const [dismissedDocIds, setDismissedDocIds] = useState<Set<string>>(() => {
    if (!id) return new Set();
    const v = localStorage.getItem(`notif-new-docs-client-${id}`);
    if (!v) return new Set();
    try { return new Set(JSON.parse(v) as string[]); } catch { return new Set(); }
  });

  // Tracks which sent invoice IDs the client has already acknowledged
  const [seenInvoiceIds, setSeenInvoiceIds] = useState<Set<string>>(() => {
    if (!id) return new Set();
    const v = localStorage.getItem(`seen-invoices-client-${id}`);
    if (!v) return new Set();
    try { return new Set(JSON.parse(v) as string[]); } catch { return new Set(); }
  });
  // Tracks comments left when declining, keyed by changeId, so the card can
  // show the comment immediately without waiting for a server refetch.
  const [optimisticDeclinedComments, setOptimisticDeclinedComments] = useState<Map<string, string>>(new Map());

  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'decline';
    changeId: string;
    title: string;
  }>({ isOpen: false, action: 'approve', changeId: '', title: '' });
  
  const [quoteApprovalModal, setQuoteApprovalModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'decline';
  }>({ isOpen: false, action: 'approve' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Job Not Found</h1>
          <p className="text-muted-foreground mt-2">The job you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const tradeProjectInfo = {
    name: project.name,
    clientName: project.clientName,
    clientEmail: project.clientEmail,
    clientAddress: project.clientAddress,
    tradeBusinessName: project.tradeBusinessName,
    tradeName: project.tradeName,
    tradeAddress: project.tradeAddress,
    tradePhone: project.tradePhone,
    tradeWebsite: project.tradeWebsite,
    abn: project.tradeAbn,
    logoUrl: project.tradeLogoUrl,
  };

  const approvedChanges = project.changeRequests.filter(cr => cr.status === 'approved');
  const approvedChangeCosts = new Set(approvedChanges.map(cr => cr.costImpact));
  const pendingChanges = project.changeRequests.filter(cr => cr.status === 'pending' || cr.status === 'awaiting_client');
  const resolvedChanges = project.changeRequests.filter(cr => cr.status === 'approved' || cr.status === 'declined');

  const includedItems = project.scopeItems.filter(item => item.category === 'included' && !isVariationItem(item.title) && !approvedChangeCosts.has(item.cost ?? -1));
  // Approved variations come from the change requests, NOT from scope_items —
  // the old approach of creating "Variation: X" scope items caused duplication.
  const variationScopeItems: ScopeItem[] = approvedChanges.map(cr => ({
    id: cr.id,
    title: cr.title,
    description: cr.description || '',
    category: 'included' as const,
    acknowledged: true,
    imageUrl: cr.imageUrl,
    imageUrls: cr.imageUrl ? [cr.imageUrl] : [],
    cost: cr.costImpact,
  }));
  const excludedItems = project.scopeItems.filter(item => item.category === 'excluded');
  const assumptionItems = project.scopeItems.filter(item => item.category === 'assumption');

  // Calculate live totals — variation duplicates filtered out; costs come from approvedChanges
  const baseQuoteLineItems = quoteLineItems.filter(item => !item.isVariation && !approvedChangeCosts.has(item.cost));
  const variationLineItems = quoteLineItems.filter(item => item.isVariation);
  const scopeSubtotal = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const changesImpact = approvedChanges.reduce((sum, cr) => sum + cr.costImpact, 0);
  const customItemsTotal = baseQuoteLineItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const subtotal = scopeSubtotal + changesImpact + customItemsTotal;
  const taxRate = activeQuote?.taxRate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const liveTotal = subtotal + taxAmount;

  // Approve without a confirmation modal — optimistically hide the button
  // immediately and fire the update in the background.
  const handleApproveChange = (changeId: string) => {
    setOptimisticApprovedIds(prev => new Set(prev).add(changeId));
    updateChangeRequestStatus(changeId, 'approved', 'trade').then(success => {
      if (success) toast.success('Approved — your trade has been notified.');
    });
  };

  const handleDeclineChange = (changeId: string) => {
    const change = project.changeRequests.find(c => c.id === changeId);
    setApprovalModal({
      isOpen: true,
      action: 'decline',
      changeId,
      title: change?.title || 'Variation',
    });
  };

  // Only used for decline confirmations now (approve is direct).
  const handleConfirmDecline = async (comment: string) => {
    const { changeId } = approvalModal;
    setOptimisticDeclinedIds(prev => new Set(prev).add(changeId));
    if (comment) {
      setOptimisticDeclinedComments(prev => {
        const next = new Map(prev);
        next.set(changeId, comment);
        return next;
      });
    }
    setApprovalModal({ isOpen: false, action: 'decline', changeId: '', title: '' });
    const success = await updateChangeRequestStatus(changeId, 'declined', 'trade', comment);
    if (success) toast.success('Declined — your trade has been notified.');
  };

  const handleRequestChange = async (description: string, imageUrl?: string) => {
    // Client creating change request → notify trade
    const success = await createChangeRequest({
      type: 'client_request',
      title: 'Variation',
      description,
      costImpact: 0,
      timeImpact: 0,
      imageUrl,
    }, 'trade');
    
    if (success) {
      toast.success('Sent! Your trade will review and respond.');
    }
  };

  const handleQuoteApproval = async (comment: string) => {
    const { action } = quoteApprovalModal;
    if (!activeQuote) return;

    try {
      const isApprove = action === 'approve';
      const updatePayload = isApprove
        ? { status: 'approved' as const, approved_at: new Date().toISOString(), client_comment: comment || null }
        : { status: 'declined' as const, declined_at: new Date().toISOString(), client_comment: comment || null };

      const { error } = await supabase
        .from('quotes')
        .update(updatePayload)
        .eq('id', activeQuote.id);

      if (error) throw error;

      if (isApprove && id) {
        await supabase
          .from('projects')
          .update({ status: 'in_progress' })
          .eq('id', id)
          .eq('status', 'sent');
      }

      await refetchQuotes();
      toast.success(
        isApprove
          ? 'Quote approved! Your tradesperson has been notified.'
          : 'Quote declined. Your tradesperson has been notified.',
      );
    } catch {
      toast.error('Failed to submit your response. Please try again.');
    }
    setQuoteApprovalModal({ isOpen: false, action: 'approve' });
  };

  const RECENTLY_UPLOADED_MS = 72 * 60 * 60 * 1000;
  const recentlyUploadedDocs = documents.filter(
    doc => (Date.now() - new Date(doc.created_at).getTime()) < RECENTLY_UPLOADED_MS
  );
  const showDocNotification = recentlyUploadedDocs.length > 0 && recentlyUploadedDocs.some(doc => !dismissedDocIds.has(doc.id));

  const dismissDocNotification = () => {
    const ids = recentlyUploadedDocs.map(doc => doc.id);
    localStorage.setItem(`notif-new-docs-client-${id}`, JSON.stringify(ids));
    setDismissedDocIds(new Set(ids));
  };

  // New invoice notification — any sent/overdue invoice the client hasn't dismissed yet
  const newSentInvoices = invoices.filter(
    inv => (inv.status === 'sent' || inv.status === 'overdue') && !seenInvoiceIds.has(inv.id)
  );
  const showInvoiceNotification = newSentInvoices.length > 0;

  const dismissInvoiceNotification = () => {
    const allSentIds = invoices
      .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
      .map(inv => inv.id);
    const updated = new Set([...seenInvoiceIds, ...allSentIds]);
    localStorage.setItem(`seen-invoices-client-${id}`, JSON.stringify([...updated]));
    setSeenInvoiceIds(updated);
  };

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader project={project} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Action Required Banner */}
        <ActionRequired 
          pendingChanges={pendingChanges}
          viewerRole="client"
          quoteAwaitingApproval={activeQuote?.status === 'sent'}
          newInvoiceCount={newSentInvoices.length}
        />

        {/* Main Content Tabs */}
        <Tabs defaultValue="quote" className="space-y-6">
          <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch] touch-pan-x overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max sm:w-auto inline-flex flex-nowrap justify-start">
              <TabsTrigger value="quote" className="gap-2">
                <FileText className="w-4 h-4 hidden sm:block" />
                Quote
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-2">
                <Receipt className="w-4 h-4 hidden sm:block" />
                Invoices
                {showInvoiceNotification && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-pending text-pending-foreground">
                    {newSentInvoices.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="changes" className="gap-2" data-testid="tab-variations">
                <RefreshCw className="w-4 h-4 hidden sm:block" />
                Variations
                {pendingChanges.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-pending text-pending-foreground">
                    {pendingChanges.length}
                  </span>
                )}
              </TabsTrigger>
              {project.stages?.length > 0 && (
                <TabsTrigger value="stages" className="gap-2">
                  <TrendingUp className="w-4 h-4 hidden sm:block" />
                  Stages
                </TabsTrigger>
              )}
              <TabsTrigger value="documents" className="gap-2">
                <FolderOpen className="w-4 h-4 hidden sm:block" />
                Documents
                {showDocNotification && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-pending text-pending-foreground">
                    {recentlyUploadedDocs.filter(doc => !dismissedDocIds.has(doc.id)).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Quote Tab */}
          <TabsContent value="quote" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Quote Details</h2>
              <p className="text-sm text-muted-foreground">
                Review and download your quote
              </p>
            </div>

            {activeQuote && activeQuote.status !== 'draft' ? (
              <Card className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{activeQuote.quoteNumber}</h3>
                      {activeQuote.status === 'sent' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-pending/15 text-foreground font-medium">
                          Awaiting Response
                        </span>
                      )}
                      {activeQuote.status === 'approved' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-approved/15 text-approved font-medium">
                          Approved
                        </span>
                      )}
                      {activeQuote.status === 'declined' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-destructive/10 text-destructive font-medium">
                          Declined
                        </span>
                      )}
                    </div>
                    {activeQuote.approvedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Approved on {new Date(activeQuote.approvedAt).toLocaleDateString()}
                      </p>
                    )}
                    {activeQuote.declinedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Declined on {new Date(activeQuote.declinedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setIsQuoteModalOpen(true)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                    <Button variant="outline" onClick={async () => {
                      try {
                        await downloadQuotePDF(
                          activeQuote,
                          tradeProjectInfo,
                          project.scopeItems,
                          project.changeRequests,
                          quoteLineItems,
                          project.tradeLogoUrl
                        );
                        toast.success('Quote PDF downloaded');
                      } catch (error) {
                        console.error('PDF download error:', error);
                        toast.error('Failed to download PDF');
                      }
                    }}>
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Included Items — base scope + base custom line items only (no variation duplicates) */}
                {(includedItems.length > 0 || baseQuoteLineItems.length > 0) && (
                  <div className="border rounded-lg divide-y">
                    {includedItems.map(item => (
                      <div key={item.id} className="p-3 flex justify-between items-start">
                        <div className="flex-1 pr-4">
                          <p className="text-sm font-medium">{item.title}</p>
                          {stripVariationMeta(item.description) && (
                            <RichTextContent html={stripVariationMeta(item.description)} className="text-xs mt-0.5" />
                          )}
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">
                          ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    {baseQuoteLineItems.map(item => (
                      <div key={item.id} className="p-3 flex justify-between items-start">
                        <div className="flex-1 pr-4">
                          <p className="text-sm font-medium">{item.title}</p>
                          {stripVariationMeta(item.description) && (
                            <RichTextContent html={stripVariationMeta(item.description)} className="text-xs mt-0.5" />
                          )}
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">
                          ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Approved Variations — separate green section */}
                {(approvedChanges.length > 0 || variationLineItems.length > 0) && (
                  <div className="border border-approved/30 rounded-lg divide-y bg-approved/5">
                    <div className="px-3 py-2 border-b border-approved/20">
                      <span className="text-xs font-semibold text-approved uppercase tracking-wide">Approved Variations</span>
                    </div>
                    {approvedChanges.map(change => (
                      <div key={change.id} className="p-3 flex justify-between items-start">
                        <div className="flex-1 pr-4">
                          <p className="text-sm font-medium">{change.title}</p>
                          {stripVariationMeta(change.description) && (
                            <p className="text-xs text-muted-foreground mt-0.5">{stripVariationMeta(change.description)}</p>
                          )}
                        </div>
                        <span className={cn(
                          "text-sm font-medium whitespace-nowrap",
                          change.costImpact > 0 ? "text-approved" : change.costImpact < 0 ? "text-destructive" : ""
                        )}>
                          {change.costImpact > 0 ? '+' : ''}${change.costImpact.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    {variationLineItems.map(item => (
                      <div key={item.id} className="p-3 flex justify-between items-start">
                        <div className="flex-1 pr-4">
                          <p className="text-sm font-medium">{item.title}</p>
                          {item.description && (
                            <RichTextContent html={item.description} className="text-xs mt-0.5" />
                          )}
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap text-approved">
                          +${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-1.5 p-4 rounded-lg bg-muted/50">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax ({taxRate}%)</span>
                    <span>${taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">
                      ${liveTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Approve/Decline Buttons for sent quotes */}
                {activeQuote.status === 'sent' && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                    <Button 
                      variant="decline" 
                      className="flex-1"
                      onClick={() => setQuoteApprovalModal({ isOpen: true, action: 'decline' })}
                    >
                      Decline Quote
                    </Button>
                    <Button 
                      variant="approve"
                      className="flex-1"
                      onClick={async () => {
                        if (!activeQuote) return;
                        try {
                          const { error } = await supabase
                            .from('quotes')
                            .update({
                              status: 'approved',
                              approved_at: new Date().toISOString(),
                              client_comment: null,
                            })
                            .eq('id', activeQuote.id);
                          if (error) throw error;
                          if (id) {
                            await supabase
                              .from('projects')
                              .update({ status: 'in_progress' })
                              .eq('id', id)
                              .eq('status', 'sent');
                          }
                          toast.success('Quote approved! Your tradesperson has been notified.');
                          await refetchQuotes();
                        } catch {
                          toast.error('Failed to approve quote');
                        }
                      }}
                    >
                      Approve Quote
                    </Button>
                  </div>
                )}

              </Card>
            ) : (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No quote available yet.</p>
              </Card>
            )}

            {(excludedItems.length > 0 || assumptionItems.length > 0) && (
              <ExclusionsPanel
                excludedItems={excludedItems}
                assumptionItems={assumptionItems}
              />
            )}
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes" className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold">Variations</h2>
                <p className="text-sm text-muted-foreground">
                  Track all modifications to the original quote
                </p>
              </div>
              <RequestChangeButton onSubmit={handleRequestChange} />
            </div>

            {/* Show client's own quote-level comment here so it's in context */}
            {activeQuote?.clientComment && (
              <Card className="p-4 bg-secondary/40 border-dashed">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Your comment on the quote
                </p>
                <p className="text-sm">{activeQuote.clientComment}</p>
              </Card>
            )}

            {/* Unified chronological activity feed — line item changes + change requests */}
            {(() => {
              const quoteEvents = activeQuote ? [
                { kind: 'quoteEvent' as const, id: 'qe-created', timestamp: activeQuote.createdAt, label: 'Quote issued' },
                ...(activeQuote.approvedAt ? [{ kind: 'quoteEvent' as const, id: 'qe-approved', timestamp: activeQuote.approvedAt, label: 'Quote accepted' }] : []),
                ...(activeQuote.declinedAt ? [{ kind: 'quoteEvent' as const, id: 'qe-declined', timestamp: activeQuote.declinedAt, label: 'Quote declined' }] : []),
              ] : [];
              const feed = [
                ...quoteEvents,
                ...lineItemHistory.map(h => ({
                  kind: 'lineItem' as const,
                  id: `li-${h.id}`,
                  timestamp: h.createdAt,
                  entry: h,
                  request: undefined,
                })),
                ...project.changeRequests.map(cr => ({
                  kind: 'changeRequest' as const,
                  id: `cr-${cr.id}`,
                  timestamp: cr.resolvedAt ?? cr.createdAt,
                  entry: undefined,
                  request: cr,
                })),
              ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

              if (feed.length === 0) {
                return (
                  <Card className="p-8 text-center">
                    <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No changes yet.</p>
                  </Card>
                );
              }

              return (
                <div className="space-y-4">
                  {feed.map(item => {
                    if (item.kind === 'quoteEvent') {
                      return (
                        <div key={item.id} className="flex items-start gap-3 px-1">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground">{item.label}</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              {item.timestamp.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' at '}
                              {item.timestamp.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    if (item.kind === 'lineItem') {
                      return (
                        <div key={item.id} className="flex items-start gap-3 px-1">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground">{formatHistoryEntry(item.entry!)}</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              {item.timestamp.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' at '}
                              {item.timestamp.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    const cr = item.request!;
                    return (
                      <ChangeRequestCard
                        relatedItemTitle={variationItemTitle(cr, project.scopeItems, quoteLineItems)}
                        key={item.id}
                        request={cr}
                        viewerRole="client"
                        onApprove={handleApproveChange}
                        onDecline={handleDeclineChange}
                        isApprovedOptimistically={optimisticApprovedIds.has(cr.id)}
                        isDeclinedOptimistically={optimisticDeclinedIds.has(cr.id)}
                        optimisticComment={optimisticDeclinedComments.get(cr.id)}
                      />
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Invoices</h2>
              <p className="text-sm text-muted-foreground">
                View and track your job invoices
              </p>
            </div>

            {showInvoiceNotification && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                    <Receipt className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-primary">
                      {newSentInvoices.length === 1 ? 'New Invoice' : `${newSentInvoices.length} New Invoices`}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {newSentInvoices.length === 1
                        ? `${newSentInvoices[0].invoiceNumber} for $${(newSentInvoices[0].total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })} has been sent to you.`
                        : `${newSentInvoices.length} invoices have been sent to you.`}
                    </p>
                  </div>
                  <button
                    onClick={dismissInvoiceNotification}
                    data-testid="button-dismiss-invoice-notification"
                    className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )}

            {invoicesLoading ? (
              <Card className="p-8 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </Card>
            ) : invoices.filter(inv => inv.status !== 'draft').length > 0 ? (
              <div className="space-y-4">
                {invoices.filter(inv => inv.status !== 'draft').map(invoice => {
                  const firstLineItem = invoice.lineItems?.[0];
                  return (
                    <Card key={invoice.id} className="p-4 sm:p-6">
                      {/* Prominent heading from first line item */}
                      {firstLineItem && (
                        <div className="mb-4 pb-3 border-b">
                          <h3 className="text-lg font-semibold text-primary border-l-4 border-primary pl-3">
                            {firstLineItem.description}
                          </h3>
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-secondary rounded-full shrink-0">
                            <FileText className="h-4 w-4 text-secondary-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{invoice.invoiceNumber}</span>
                              <Badge variant={
                                invoice.status === 'paid' ? 'success' :
                                invoice.status === 'overdue' ? 'destructive' :
                                invoice.status === 'sent' ? 'secondary' : 'outline'
                              }>
                                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                              </Badge>
                              <Badge variant="outline">
                                {invoice.type === 'staged' ? 'Progress' : 'Final'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Created {format(new Date(invoice.createdAt), 'dd MMM yyyy')}
                              {invoice.dueDate && (
                                <> • Due {format(new Date(invoice.dueDate), 'dd MMM yyyy')}</>
                              )}
                            </p>
                            {invoice.paidAt && (
                              <p className="text-xs text-approved mt-1">
                                Paid on {format(new Date(invoice.paidAt), 'dd MMM yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <p className="text-xl font-bold">
                            ${(invoice.total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground">inc. GST</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-4 pt-3 border-t">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setViewingInvoice(invoice)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            try {
                              downloadInvoicePDF(invoice, tradeProjectInfo);
                              toast.success('Invoice PDF downloaded');
                            } catch (error) {
                              console.error('PDF download error:', error);
                              toast.error('Failed to download PDF');
                            }
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No invoices yet.</p>
              </Card>
            )}

            {/* Invoice View Modal */}
            <InvoiceViewModal
              isOpen={!!viewingInvoice}
              onClose={() => setViewingInvoice(null)}
              invoice={viewingInvoice}
              project={tradeProjectInfo}
            />
          </TabsContent>

          {/* Stages Tab */}
          {project.stages?.length > 0 && (
            <TabsContent value="stages" className="space-y-4 animate-fade-in">
              <div>
                <h2 className="font-heading text-xl font-bold">Job Stages</h2>
                <p className="text-sm text-muted-foreground">
                  See where your job is at and what's coming next
                </p>
              </div>

              <Card className="p-4 sm:p-6">
                <ProjectTimeline 
                  stages={project.stages} 
                  currentStageIndex={project.currentStageIndex}
                />
              </Card>
            </TabsContent>
          )}

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Documents</h2>
              <p className="text-sm text-muted-foreground">
                Job files and attachments
              </p>
            </div>

            {showDocNotification && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                    <FolderOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-primary">New Documents</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {recentlyUploadedDocs.filter(doc => !dismissedDocIds.has(doc.id)).length === 1
                        ? '1 document was added recently.'
                        : `${recentlyUploadedDocs.filter(doc => !dismissedDocIds.has(doc.id)).length} documents were added recently.`}
                    </p>
                  </div>
                  <button
                    onClick={dismissDocNotification}
                    data-testid="button-dismiss-doc-notification-client"
                    className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )}

            <ClientDocumentsSection
              documents={documents}
              projectId={id ?? ''}
              onRefresh={refetchProject}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Change Request Approval Modal */}
      <ApprovalModal
        isOpen={approvalModal.isOpen}
        onClose={() => setApprovalModal({ isOpen: false, action: 'approve', changeId: '', title: '' })}
        onConfirm={handleConfirmDecline}
        action={approvalModal.action}
        title={approvalModal.title}
      />

      {/* Quote Approval Modal */}
      <ApprovalModal
        isOpen={quoteApprovalModal.isOpen}
        onClose={() => setQuoteApprovalModal({ isOpen: false, action: 'approve' })}
        onConfirm={handleQuoteApproval}
        action={quoteApprovalModal.action}
        title={activeQuote?.quoteNumber || 'Quote'}
      />

      {/* Quote View Modal */}
      {activeQuote && (
        <QuoteViewModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          quote={activeQuote}
          scopeItems={project.scopeItems}
          changeRequests={project.changeRequests}
          quoteLineItems={quoteLineItems}
          projectInfo={{ ...tradeProjectInfo, logoUrl: project.tradeLogoUrl }}
        />
      )}

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-muted-foreground">
          <p>This job page is provided by {project.tradeBusinessName}</p>
          <p className="mt-1">Questions? Contact {project.tradeName} directly.</p>
        </div>
      </footer>
    </div>
  );
}
