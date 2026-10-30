import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, parseDefaultTerms } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { ImageDisplay } from '@/components/ImageUpload';
import { SendChangeRequestModal } from '@/components/SendChangeRequestModal';
import { EditChangeRequestModal } from '@/components/EditChangeRequestModal';
import { RespondToClientModal } from '@/components/RespondToClientModal';
import { StageManager } from '@/components/StageManager';
import { DocumentsSection } from '@/components/DocumentsSection';
import { JobSectionMenu } from '@/components/JobSectionMenu';
import { JobHeader } from '@/components/JobHeader';
import { PageLayout } from '@/components/PageLayout';
import { ApprovalModal } from '@/components/ApprovalModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QuoteSection } from '@/components/QuoteSection';
import { InvoiceSection } from '@/components/InvoiceSection';
import { useProject } from '@/hooks/useProject';
import { useCreateProject } from '@/hooks/useCreateProject';
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuoteLineItems } from '@/hooks/useQuoteLineItems';
import { useLineItemHistory, formatHistoryEntry } from '@/hooks/useLineItemHistory';
import { ChangeRequestCard } from '@/components/ChangeRequestCard';
import { variationItemTitle } from '@/lib/variationItems';
import { ScopeItem, ChangeRequest, ProjectStage } from '@/types/project';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  ExternalLink, 
  Send, 
  Plus,
  Package,
  AlertTriangle,
  Pencil,
  User,
  Mail,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  AlertCircle,
  X,
  MoreVertical,
  RotateCcw,
  FolderOpen,
} from 'lucide-react';
import { cn, getClientProjectUrl, getQuoteShareUrl, cleanVariationTitle, isVariationItem, stripVariationMeta } from '@/lib/utils';
import { RichTextContent } from '@/components/RichTextEditor';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { JobCostsTab } from '@/components/job-costing/JobCostsTab';
import { TeamHome } from '@/components/TeamPortalUI';
import { jobDisplayStatus } from '@/lib/quoteDisplay';

export default function ProjectManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const {
    project,
    documents,
    loading,
    refetch,
    saveScopeItem,
    deleteScopeItem,
    createChangeRequest,
    updateChangeRequest,
    deleteChangeRequest,
    updateChangeRequestStatus,
    respondToClientRequest,
    updateStage,
    addStage,
    editStage,
    deleteStage,
    reorderStages,
    clearAllStages,
    updateProjectStatus,
  } = useProject(id);
  const { createProject } = useCreateProject();

  const {
    activeQuote,
    createQuote,
    updateQuote,
    sendQuote,
    approveQuote,
    reviseQuote,
    regenerateQuoteToken,
  } = useQuotes(id);

  const {
    lineItems: quoteLineItems,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  } = useQuoteLineItems(activeQuote?.id);

  const { history: lineItemHistory } = useLineItemHistory(activeQuote?.id);

  const {
    invoices,
    createInvoice,
    updateInvoiceNumber,
    sendInvoice,
    markAsPaid,
    cancelInvoice,
    deleteInvoice,
  } = useInvoices(id);

  // Enrich the active quote with a computed total whenever the stored total is
  // 0 (null in DB maps to 0 via `|| 0`). Mirrors the exact formula used by
  // QuoteSection: scope items (included, non-variation) + approved change
  // requests + custom quote line items, de-duped by the approvedChangeCosts set.
  const effectiveQuote = useMemo(() => {
    if (!activeQuote || !project) return null;
    if (activeQuote.total > 0) return activeQuote;

    const approvedChanges = project.changeRequests.filter(cr => cr.status === 'approved');
    const approvedChangeCosts = new Set(approvedChanges.map(cr => cr.costImpact));
    const changesImpact = approvedChanges.reduce((sum, cr) => sum + cr.costImpact, 0);

    const scopeSubtotal = project.scopeItems
      .filter(item =>
        item.category === 'included' &&
        !isVariationItem(item.title) &&
        !approvedChangeCosts.has(item.cost ?? -1)
      )
      .reduce((sum, item) => sum + (item.cost || 0), 0);

    const customItemsTotal = quoteLineItems
      .filter(item => !isVariationItem(item.title) && !approvedChangeCosts.has(item.cost))
      .reduce((sum, item) => sum + (item.cost || 0), 0);

    const subtotal = scopeSubtotal + changesImpact + customItemsTotal;
    if (subtotal === 0) return activeQuote;

    const taxRate = activeQuote.taxRate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    return { ...activeQuote, subtotal, taxAmount, total: subtotal + taxAmount };
  }, [activeQuote, quoteLineItems, project]);

  // Check for tab query param (e.g., from job creation)
  const rawTab = searchParams.get('tab') || 'quote';
  const initialTab = rawTab === 'scope' ? 'quote' : rawTab;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSendingChangeRequest, setIsSendingChangeRequest] = useState(false);
  const [editingChangeRequest, setEditingChangeRequest] = useState<ChangeRequest | null>(null);
  const [respondingToRequest, setRespondingToRequest] = useState<ChangeRequest | null>(null);
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'decline';
    changeId: string;
    title: string;
  }>({ isOpen: false, action: 'approve', changeId: '', title: '' });
  const [isRegeneratingToken, setIsRegeneratingToken] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [defaultTerms, setDefaultTerms] = useState<string>('');
  const [defaultQuoteTerms, setDefaultQuoteTerms] = useState<string>('');
  const [defaultPaymentInstructions, setDefaultPaymentInstructions] = useState<string>('');
  // Dismissed notification state — persisted per project in localStorage
  const [dismissedActionCount, setDismissedActionCount] = useState<number>(() => {
    if (!id) return -1;
    const v = localStorage.getItem(`notif-action-required-${id}`);
    return v !== null ? parseInt(v, 10) : -1;
  });
  const [dismissedVariationIds, setDismissedVariationIds] = useState<Set<string>>(() => {
    if (!id) return new Set();
    const v = localStorage.getItem(`notif-variation-update-${id}`);
    if (!v) return new Set();
    try { return new Set(JSON.parse(v) as string[]); } catch { return new Set(); }
  });
  const [dismissedDocIds, setDismissedDocIds] = useState<Set<string>>(() => {
    if (!id) return new Set();
    const v = localStorage.getItem(`notif-new-docs-${id}`);
    if (!v) return new Set();
    try { return new Set(JSON.parse(v) as string[]); } catch { return new Set(); }
  });

  // Rehydrate dismiss state if the project ID changes without a full remount
  useEffect(() => {
    if (!id) return;
    const actionVal = localStorage.getItem(`notif-action-required-${id}`);
    setDismissedActionCount(actionVal !== null ? parseInt(actionVal, 10) : -1);
    const varVal = localStorage.getItem(`notif-variation-update-${id}`);
    if (varVal) {
      try { setDismissedVariationIds(new Set(JSON.parse(varVal) as string[])); } catch { setDismissedVariationIds(new Set()); }
    } else {
      setDismissedVariationIds(new Set());
    }
    const docVal = localStorage.getItem(`notif-new-docs-${id}`);
    if (docVal) {
      try { setDismissedDocIds(new Set(JSON.parse(docVal) as string[])); } catch { setDismissedDocIds(new Set()); }
    } else {
      setDismissedDocIds(new Set());
    }
  }, [id]);

  const [tradeProfileInfo, setTradeProfileInfo] = useState<{
    address: string;
    phone: string;
    website: string;
    abn: string;
    logoUrl: string;
  }>({ address: '', phone: '', website: '', abn: '', logoUrl: '' });

  // Fetch user's profile defaults
  useEffect(() => {
    const fetchDefaults = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('default_terms, default_payment_instructions, phone, business_address, abn, website, logo_url')
        .eq('user_id', user.id)
        .single();

      if (profile?.default_terms) {
        const parsed = parseDefaultTerms(profile.default_terms);
        setDefaultTerms(parsed.invoice);
        setDefaultQuoteTerms(parsed.quote);
      }
      if (profile?.default_payment_instructions) {
        setDefaultPaymentInstructions(profile.default_payment_instructions);
      }

      // logo_url is stored as a base64 data URL directly in the profile
      const storedLogo = (profile as any)?.logo_url || '';
      const logoUrl = storedLogo.startsWith('data:') ? storedLogo : '';

      setTradeProfileInfo({
        address: (profile as any)?.business_address || '',
        phone: profile?.phone || '',
        website: (profile as any)?.website || '',
        abn: (profile as any)?.abn || '',
        logoUrl,
      });
    };
    fetchDefaults();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Job not found</p>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleSaveScopeItem = async (itemData: Omit<ScopeItem, 'id' | 'acknowledged'> & { id?: string }) => {
    const success = await saveScopeItem(itemData);
    if (success) {
      toast.success(itemData.id ? 'Item updated' : 'Item added');
    }
    return success;
  };

  const handleDeleteScopeItem = async (itemId: string) => {
    const success = await deleteScopeItem(itemId);
    if (success) {
      toast.success('Item deleted');
    }
    return success;
  };

  const handleSendChangeRequest = async (requestData: Omit<ChangeRequest, 'id' | 'status' | 'createdAt' | 'resolvedAt'>) => {
    // Trade creating change request → notify client
    const success = await createChangeRequest(requestData, 'client');
    if (success) {
      toast.success('Variation sent to client');
      setIsSendingChangeRequest(false);
    }
    return success;
  };

  const handleUpdateChangeRequest = async (requestData: ChangeRequest) => {
    const success = await updateChangeRequest(requestData);
    if (success) {
      toast.success('Variation updated');
      setEditingChangeRequest(null);
    }
    return success;
  };

  const handleDeleteChangeRequest = async (requestId: string) => {
    const success = await deleteChangeRequest(requestId);
    if (success) {
      toast.success('Variation deleted');
      setEditingChangeRequest(null);
    }
  };

  const handleRespondToClient = (requestId: string) => {
    const request = project.changeRequests.find(c => c.id === requestId);
    if (request) {
      setRespondingToRequest(request);
    }
  };

  const handleSubmitResponse = async (data: {
    title: string;
    description: string;
    costImpact: number;
    timeImpact: number;
    reason?: string;
    imageUrl?: string;
  }) => {
    if (!respondingToRequest) return;
    const success = await respondToClientRequest(respondingToRequest.id, data);
    if (success) {
      toast.success('Response sent to client for approval');
      setRespondingToRequest(null);
    }
  };

  const handleConfirmApproval = async (comment: string) => {
    const { action, changeId } = approvalModal;
    const success = await updateChangeRequestStatus(changeId, action === 'approve' ? 'approved' : 'declined', 'client', comment);
    if (success) {
      toast.success(action === 'approve' ? 'Client request approved' : 'Client request declined');
    }
    setApprovalModal({ isOpen: false, action: 'approve', changeId: '', title: '' });
  };

  const handleUpdateStage = async (stageId: string, status: 'upcoming' | 'current' | 'completed') => {
    await updateStage(stageId, status);
  };

  const handleSetCurrentStage = async (index: number) => {
    if (project.stages[index]) {
      // Set all previous stages to completed, current to current, rest to upcoming
      for (let i = 0; i < project.stages.length; i++) {
        const newStatus = i < index ? 'completed' : i === index ? 'current' : 'upcoming';
        await updateStage(project.stages[i].id, newStatus);
      }
    }
  };

  const handleGenerateStageInvoice = async (stage: ProjectStage, amount: number) => {
    // Navigate to invoices tab and create an invoice for this stage
    setActiveTab('invoices');
    
    // Create invoice with stage details
    // amount is already the ex-tax subtotal (invoiceAmount is ex-tax; invoicePercentage uses subtotal)
    const invoiceId = await createInvoice({
      type: 'staged',
      quoteId: effectiveQuote?.id,
      stageId: stage.id,
      taxRate: effectiveQuote?.taxRate ?? 10,
      lineItems: [{
        description: `Stage Payment: ${stage.name}`,
        quantity: 1,
        unitPrice: amount,
      }],
    });

    if (invoiceId) {
      toast.success(`Invoice created for "${stage.name}"`);
    }
  };

  const handleCreateFinalInvoice = async (quoteId: string) => {
    if (!activeQuote || activeQuote.id !== quoteId) return false;
    const approvedChanges = project.changeRequests.filter(change => change.status === 'approved');
    const approvedChangeCosts = new Set(approvedChanges.map(change => change.costImpact));
    const lineItems = [
      ...project.scopeItems
        .filter(item => item.category === 'included' && !isVariationItem(item.title) && !approvedChangeCosts.has(item.cost ?? -1))
        .map(item => ({
          description: cleanVariationTitle(item.title),
          quantity: 1,
          unitPrice: item.cost ?? 0,
          scopeItemId: item.id,
        })),
      ...approvedChanges.map(change => ({
        description: cleanVariationTitle(change.title),
        quantity: 1,
        unitPrice: change.costImpact,
        changeRequestId: change.id,
      })),
      ...quoteLineItems
        .filter(item => !item.isVariation && !approvedChangeCosts.has(item.cost))
        .map(item => ({
          description: cleanVariationTitle(item.title),
          quantity: 1,
          unitPrice: item.cost,
        })),
    ];
    if (!lineItems.length) return false;

    const invoiceId = await createInvoice({
      type: 'final',
      quoteId: activeQuote.id,
      taxRate: activeQuote.taxRate,
      notes: activeQuote.notes,
      terms: activeQuote.terms,
      lineItems,
    });
    if (invoiceId) setActiveTab('invoices');
    return !!invoiceId;
  };

  const handleSendToClient = async () => {
    const success = await updateProjectStatus('sent');
    if (success) {
      toast.success('Job sent to client!');
    }
  };

  const handleCopyClientLink = async () => {
    try {
      const link = await getClientProjectUrl(project.id);
      await navigator.clipboard.writeText(link);
      toast.success('Client page link copied!', {
        description: 'Share with your client for full transparency.'
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create a secure client link. Please retry.');
    }
  };

  const handlePreviewClientPage = async () => {
    // Open synchronously while the browser still considers this a user action.
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    try {
      const link = await getClientProjectUrl(project.id);
      if (previewWindow) {
        previewWindow.location.href = link;
      } else {
        toast.error('Your browser blocked the preview window. Allow pop-ups and try again.');
      }
    } catch (error) {
      previewWindow?.close();
      toast.error(error instanceof Error ? error.message : 'Could not open the secure client preview. Please retry.');
    }
  };

  const handleDuplicateProject = async () => {
    // The current create flow persists a new job and draft quote. Copy the saved
    // scope only; associated costs, invoices, stages, variations and team records
    // remain attached to the original job.
    if (isDuplicating) return;
    setIsDuplicating(true);
    try {
      const duplicateId = await createProject({
        name: `${project.name} (copy)`,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        projectStatus: 'draft',
        ...(project.clientAddress ? { clientAddress: project.clientAddress } : {}),
        quoteData: {
          lineItems: project.scopeItems.map(item => ({
            title: item.title,
            description: item.description ?? '',
            cost: item.cost ?? 0,
            category: item.category,
            imageUrl: item.imageUrls?.[0] ?? item.imageUrl,
          })),
          taxRate: activeQuote?.taxRate ?? 10,
          validUntil: null,
          notes: activeQuote?.notes ?? '',
          terms: activeQuote?.terms ?? '',
        },
      });
      if (duplicateId) {
        toast.success('Job copy created', {
          description: 'Saved scope and quote terms copied. Costs, invoices, stages, variations and team records remain with the original.',
        });
        navigate(`/manage/${duplicateId}?tab=quote`);
      }
    } finally {
      setIsDuplicating(false);
    }
  };

  // Separate pending changes into client requests (need trade response) and trade requests (awaiting client)
  const pendingClientRequests = project.changeRequests.filter(
    cr => cr.status === 'pending' && cr.type === 'client_request'
  );
  const resolvedChanges = project.changeRequests.filter(cr => cr.status === 'approved' || cr.status === 'declined');
  // Variations resolved in the last 72 hours — shown with a "New" badge
  const RECENTLY_RESOLVED_MS = 72 * 60 * 60 * 1000;
  const recentlyResolvedChanges = resolvedChanges.filter(
    cr => cr.resolvedAt && (Date.now() - cr.resolvedAt.getTime()) < RECENTLY_RESOLVED_MS
  );

  // Derived visibility — reappears automatically when new items arrive
  const showActionRequired = pendingClientRequests.length > 0 && pendingClientRequests.length > dismissedActionCount;
  const showVariationUpdate = recentlyResolvedChanges.length > 0 && recentlyResolvedChanges.some(cr => !dismissedVariationIds.has(cr.id));
  const recentlyUploadedDocs = documents.filter(
    doc => (Date.now() - new Date(doc.created_at).getTime()) < RECENTLY_RESOLVED_MS
  );
  const showDocNotification = recentlyUploadedDocs.length > 0 && recentlyUploadedDocs.some(doc => !dismissedDocIds.has(doc.id));
  const activityEvents = [
    { id: 'job-created', timestamp: project.createdAt, label: 'Job created', detail: project.name, kind: 'job' as const },
    ...(activeQuote ? [
      { id: 'quote-created', timestamp: activeQuote.createdAt, label: 'Quote created', detail: activeQuote.quoteNumber, kind: 'quote' as const },
      ...(activeQuote.approvedAt ? [{ id: 'quote-approved', timestamp: activeQuote.approvedAt, label: 'Quote accepted by client', detail: activeQuote.quoteNumber, kind: 'quote' as const }] : []),
      ...(activeQuote.declinedAt ? [{ id: 'quote-declined', timestamp: activeQuote.declinedAt, label: 'Quote declined by client', detail: activeQuote.quoteNumber, kind: 'quote' as const }] : []),
    ] : []),
    ...invoices.map(invoice => ({
      id: `invoice-${invoice.id}`,
      timestamp: invoice.updatedAt ?? invoice.createdAt,
      label: invoice.status === 'paid'
        ? 'Invoice marked paid'
        : invoice.status === 'sent'
          ? 'Invoice sent'
          : invoice.status === 'overdue'
            ? 'Invoice overdue'
            : invoice.status === 'cancelled'
              ? 'Invoice cancelled'
              : 'Invoice created',
      detail: invoice.invoiceNumber,
      kind: 'invoice' as const,
    })),
    ...documents.map(document => ({
      id: `document-${document.id}`,
      timestamp: new Date(document.created_at),
      label: 'Document added',
      detail: document.display_name || document.file_name,
      kind: 'document' as const,
    })),
    ...lineItemHistory.map(entry => ({
      id: `line-item-${entry.id}`,
      timestamp: entry.createdAt,
      label: formatHistoryEntry(entry),
      detail: 'Quote line item',
      kind: 'line-item' as const,
    })),
    ...project.changeRequests.map(request => ({
      id: `variation-${request.id}`,
      timestamp: request.resolvedAt ?? request.createdAt,
      label: request.status === 'approved'
        ? 'Variation approved'
        : request.status === 'declined'
          ? 'Variation declined'
          : request.status === 'awaiting_client'
            ? 'Variation sent to client'
            : 'Variation raised',
      detail: cleanVariationTitle(request.title),
      kind: 'variation' as const,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const dismissActionRequired = () => {
    const count = pendingClientRequests.length;
    localStorage.setItem(`notif-action-required-${id}`, String(count));
    setDismissedActionCount(count);
  };
  const dismissVariationUpdate = () => {
    const ids = recentlyResolvedChanges.map(cr => cr.id);
    localStorage.setItem(`notif-variation-update-${id}`, JSON.stringify(ids));
    setDismissedVariationIds(new Set(ids));
  };
  const dismissDocNotification = () => {
    const ids = recentlyUploadedDocs.map(doc => doc.id);
    localStorage.setItem(`notif-new-docs-${id}`, JSON.stringify(ids));
    setDismissedDocIds(new Set(ids));
  };

  return (
    <AppShell>
      <JobHeader>
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="mt-0.5 h-11 w-11 flex-shrink-0" aria-label="Back to dashboard" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                <h1 className="min-w-0 break-words font-heading text-xl font-bold sm:text-2xl">{project.name}</h1>
                <StatusBadge className="mt-0.5 shrink-0" status={jobDisplayStatus(project, activeQuote ? {
                  status: activeQuote.status,
                  valid_until: activeQuote.validUntil?.toISOString() ?? null,
                } : null)} />
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex shrink-0 items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {project.clientName}
                </span>
                <span className="flex min-w-0 max-w-full items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{project.clientEmail}</span>
                </span>
                {project.clientAddress && (
                  <span className="flex min-w-0 max-w-full items-center gap-1" data-testid="text-client-address">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{project.clientAddress}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex w-full min-w-0 items-center">
            <div className="flex min-w-0 shrink-0 items-center gap-0 sm:gap-1">
              {project.status === 'draft' && (
                <Button variant="accent" size="sm" className="h-11 w-11 shrink-0 px-0 sm:w-auto sm:px-3" aria-label="Send job to client" onClick={handleSendToClient}>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:ml-2 sm:inline">Send to Client</span>
                </Button>
              )}
              {/* Project actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 shrink-0 gap-2 border-zinc-400 bg-white px-3 text-sm text-zinc-900" aria-label="Actions" data-testid="button-project-actions-menu">
                    <MoreVertical className="w-4 h-4" />
                    <span>Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem
                    onClick={() => void handleDuplicateProject()}
                    disabled={isDuplicating}
                    className="min-h-11 gap-2"
                    data-testid="menu-item-duplicate-project"
                  >
                    {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    {isDuplicating ? 'Creating copy…' : 'Duplicate job'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void handleCopyClientLink()}
                    className="min-h-11 gap-2"
                    data-testid="menu-item-share-link"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Share link
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handlePreviewClientPage}
                    className="min-h-11 gap-2"
                    data-testid="menu-item-preview-client-page"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Preview client page
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job status</DropdownMenuLabel>
                  {project.status !== 'completed' ? (
                    <DropdownMenuItem
                      onClick={() => updateProjectStatus('completed')}
                      className="min-h-11 gap-2"
                      data-testid="menu-item-mark-completed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-approved" />
                      Mark as Completed
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => updateProjectStatus('in_progress')}
                      className="min-h-11 gap-2"
                      data-testid="menu-item-mark-in-progress"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Mark as In Progress
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled
                    title="Job archiving is not available because the current project schema has no archive state."
                    className="min-h-14 cursor-not-allowed items-start gap-2 opacity-100"
                    data-testid="menu-item-archive-unavailable"
                  >
                    <FolderOpen className="mt-0.5 h-4 w-4 text-zinc-500" />
                    <span className="min-w-0">
                      <span className="block font-medium text-zinc-700">Archive unavailable</span>
                      <span className="mt-0.5 block whitespace-normal text-xs leading-4 text-zinc-600">Jobs have no archive state in the current schema.</span>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="mt-3 w-full min-w-0">
            <JobSectionMenu
              value={activeTab}
              onValueChange={setActiveTab}
              invoiceCount={invoices.length}
              pendingVariationCount={pendingClientRequests.length}
              documentNotificationCount={
                showDocNotification
                  ? recentlyUploadedDocs.filter(doc => !dismissedDocIds.has(doc.id)).length
                  : 0
              }
            />
          </div>
        </div>
      </JobHeader>

      <PageLayout headerless className="!py-6">
        {/* Notification banners */}
        {(showActionRequired || showVariationUpdate || showDocNotification) && (
          <div className="space-y-3 mb-6">
            {showActionRequired && (
              <Card className="p-4 bg-pending/5 border-pending/30">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-pending/20 flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-pending-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-pending-foreground">Action Required</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your client has submitted {pendingClientRequests.length} variation{pendingClientRequests.length > 1 ? 's' : ''} that {pendingClientRequests.length > 1 ? 'need' : 'needs'} your response — see the Variations tab.
                    </p>
                  </div>
                  <button
                    onClick={dismissActionRequired}
                    data-testid="button-dismiss-action-required"
                    className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )}
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
                        ? '1 document was uploaded recently — see the Documents tab.'
                        : `${recentlyUploadedDocs.filter(doc => !dismissedDocIds.has(doc.id)).length} documents were uploaded recently — see the Documents tab.`}
                    </p>
                  </div>
                  <button
                    onClick={dismissDocNotification}
                    data-testid="button-dismiss-doc-notification"
                    className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )}
            {showVariationUpdate && (
              <Card className="p-4 bg-approved/5 border-approved/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-approved/10 flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-approved" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-approved">Variations Update</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(() => {
                        const approvedCount = recentlyResolvedChanges.filter(cr => cr.status === 'approved').length;
                        const declinedCount = recentlyResolvedChanges.filter(cr => cr.status === 'declined').length;
                        const parts: string[] = [];
                        if (approvedCount > 0) parts.push(`${approvedCount} variation${approvedCount > 1 ? 's' : ''} approved`);
                        if (declinedCount > 0) parts.push(`${declinedCount} variation${declinedCount > 1 ? 's' : ''} declined`);
                        return `${parts.join(' and ')} by your client recently — see the Variations tab for details.`;
                      })()}
                    </p>
                  </div>
                  <button
                    onClick={dismissVariationUpdate}
                    data-testid="button-dismiss-variation-update"
                    className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
          <TabsContent value="costs" className="mt-0" role="region" aria-labelledby={undefined} aria-label="Costs">
            <JobCostsTab jobId={project.id} />
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes" className="mt-0 space-y-6" role="region" aria-labelledby={undefined} aria-label="Variations">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-heading text-lg font-semibold">Variations</h2>
              <Button className="min-h-11 w-full sm:w-auto" onClick={() => setIsSendingChangeRequest(true)}>
                <Plus className="w-4 h-4 mr-2" />
                + Add Variation
              </Button>
            </div>

            {/* Client's comment on the quote — shown here so it's in context */}
            {activeQuote?.clientComment && (
              <Card className="p-4 bg-secondary/40 border-dashed">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Client's comment on the quote
                </p>
                <p className="text-sm">{activeQuote.clientComment}</p>
              </Card>
            )}

            {/* Respond to Client Modal — always present, controlled by state */}
            <RespondToClientModal
              isOpen={!!respondingToRequest}
              onClose={() => setRespondingToRequest(null)}
              request={respondingToRequest}
              onSubmit={handleSubmitResponse}
            />

            {project.changeRequests.length === 0 ? (
              <Card className="p-10 text-center">
                <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                <p className="mb-4 text-muted-foreground">No variations yet</p>
                <Button className="min-h-11" onClick={() => setIsSendingChangeRequest(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add first variation
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {recentlyResolvedChanges.some(cr => cr.status === 'approved') && (
                  <div className="flex items-center gap-2 rounded-lg border border-approved/20 bg-approved/10 p-3">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-approved" />
                    <p className="text-sm font-medium text-approved">
                      {recentlyResolvedChanges.filter(cr => cr.status === 'approved').length} variation{recentlyResolvedChanges.filter(cr => cr.status === 'approved').length === 1 ? '' : 's'} approved in the last 72 hours.
                    </p>
                  </div>
                )}
                {project.changeRequests.map(request => request.status === 'pending' ? (
                  <ChangeRequestCard
                    key={request.id}
                    request={request}
                    relatedItemTitle={variationItemTitle(request, project.scopeItems, quoteLineItems)}
                    viewerRole="trade"
                    onRespond={handleRespondToClient}
                  />
                ) : (
                  <ChangeRequestItem
                    key={request.id}
                    relatedItemTitle={variationItemTitle(request, project.scopeItems, quoteLineItems)}
                    request={request}
                    onEdit={() => setEditingChangeRequest(request)}
                    isNew={recentlyResolvedChanges.some(resolved => resolved.id === request.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Quote Tab */}
          <TabsContent value="quote" className="mt-0 min-w-0 space-y-4" role="region" aria-labelledby={undefined} aria-label="Quote">
            {activeQuote?.quoteToken && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Shareable Quote Link</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getQuoteShareUrl(activeQuote.quoteToken)}
                    </p>
                    {activeQuote.tokenUpdatedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-token-updated-at">
                        {activeQuote.tokenRegenerated ? 'Last regenerated' : 'Link generated'}:{' '}
                        {activeQuote.tokenUpdatedAt.toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getQuoteShareUrl(activeQuote.quoteToken));
                      toast.success('Quote link copied!', {
                        description: 'Send this link to your client so they can review and accept the quote.',
                      });
                    }}
                    className="w-full sm:w-auto"
                    data-testid="button-copy-quote-link"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRegeneratingToken}
                    onClick={() => setIsRegenerateConfirmOpen(true)}
                    className="w-full sm:w-auto"
                    data-testid="button-regenerate-quote-link"
                  >
                    {isRegeneratingToken ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Regenerate Link
                  </Button>
                </div>
              </div>
            )}
            <QuoteSection
              scopeItems={project.scopeItems}
              changeRequests={project.changeRequests}
              quote={activeQuote}
              clientName={project.clientName}
              clientEmail={project.clientEmail}
              clientAddress={project.clientAddress}
              projectName={project.name}
              tradeBusinessName={project.tradeBusinessName}
              tradeName={project.tradeName}
              tradeAddress={tradeProfileInfo.address}
              tradePhone={tradeProfileInfo.phone}
              tradeWebsite={tradeProfileInfo.website}
              tradeAbn={tradeProfileInfo.abn}
              logoUrl={tradeProfileInfo.logoUrl}
              quoteLineItems={quoteLineItems}
              defaultTerms={defaultQuoteTerms}
              onAddLineItem={addLineItem}
              onUpdateLineItem={updateLineItem}
              onDeleteLineItem={deleteLineItem}
              onCreateQuote={createQuote}
              onUpdateQuote={updateQuote}
              onSendQuote={sendQuote}
              onApproveQuote={approveQuote}
              onCreateInvoice={handleCreateFinalInvoice}
              onReviseQuote={reviseQuote}
              onSaveScopeItem={handleSaveScopeItem}
              onDeleteScopeItem={handleDeleteScopeItem}
            />
          </TabsContent>

          <TabsContent value="activity" className="mt-0" role="region" aria-labelledby={undefined} aria-label="Activity">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
                <div>
                  <h2 className="font-heading text-lg font-semibold">Job activity</h2>
                  <p className="mt-1 text-sm text-muted-foreground">A record of saved quote, line-item and variation events.</p>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{activityEvents.length} {activityEvents.length === 1 ? 'event' : 'events'}</span>
              </div>
              {activityEvents.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">No activity recorded yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Saved job events will appear here.</p>
                </div>
              ) : (
                <ol className="divide-y divide-border">
                  {activityEvents.map(event => (
                    <li key={event.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-900">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{event.label}</p>
                        <p className="mt-0.5 break-words text-sm text-muted-foreground">{event.detail}</p>
                      </div>
                      <time className="shrink-0 pt-0.5 text-right text-sm text-muted-foreground" dateTime={event.timestamp.toISOString()}>
                        {format(event.timestamp, 'd MMM yyyy · h:mm a')}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-0" role="region" aria-labelledby={undefined} aria-label="Invoices">
            <InvoiceSection
              invoices={invoices}
              quote={activeQuote}
              scopeItems={project.scopeItems}
              changeRequests={project.changeRequests}
              quoteLineItems={quoteLineItems}
              projectName={project.name}
              clientName={project.clientName}
              clientEmail={project.clientEmail}
              clientAddress={project.clientAddress}
              tradeBusinessName={project.tradeBusinessName}
              tradeName={project.tradeName}
              tradeAddress={tradeProfileInfo.address}
              tradePhone={tradeProfileInfo.phone}
              tradeWebsite={tradeProfileInfo.website}
              tradeAbn={tradeProfileInfo.abn}
              logoUrl={tradeProfileInfo.logoUrl}
              defaultTerms={defaultTerms}
              defaultPaymentInstructions={defaultPaymentInstructions}
              onCreateInvoice={createInvoice}
              onUpdateInvoiceNumber={updateInvoiceNumber}
              onSendInvoice={sendInvoice}
              onMarkAsPaid={markAsPaid}
              onCancelInvoice={cancelInvoice}
              onDeleteInvoice={deleteInvoice}
            />
          </TabsContent>

          {/* Stages Tab */}
          <TabsContent value="stages" className="mt-0" role="region" aria-labelledby={undefined} aria-label="Stages">
            <StageManager
              stages={project.stages}
              currentStageIndex={project.currentStageIndex}
              invoices={invoices}
              quote={effectiveQuote}
              onUpdateStage={handleUpdateStage}
              onSetCurrentStage={handleSetCurrentStage}
              onAddStage={addStage}
              onEditStage={editStage}
              onDeleteStage={deleteStage}
              onReorderStages={reorderStages}
              onClearAllStages={clearAllStages}
              onGenerateStageInvoice={handleGenerateStageInvoice}
            />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-0" role="region" aria-labelledby={undefined} aria-label="Documents">
            <DocumentsSection
              projectId={project.id}
              documents={documents}
              onRefresh={refetch}
            />
          </TabsContent>
          <TabsContent value="staff" className="mt-0" role="region" aria-label="Assigned staff">
            <TeamHome panel="staff" embedded />
          </TabsContent>
          <TabsContent value="timesheets" className="mt-0" role="region" aria-label="Job timesheets">
            <TeamHome panel="timesheets" embedded />
          </TabsContent>
          <TabsContent value="employee-updates" className="mt-0" role="region" aria-label="Employee updates">
            <TeamHome panel="updates" embedded />
          </TabsContent>
        </Tabs>
      </PageLayout>

      {/* Modals */}
      <SendChangeRequestModal
        open={isSendingChangeRequest}
        onOpenChange={setIsSendingChangeRequest}
        onSend={handleSendChangeRequest}
        scopeItems={project.scopeItems}
        quoteItems={quoteLineItems}
      />

      <EditChangeRequestModal
        open={!!editingChangeRequest}
        onOpenChange={(open) => {
          if (!open) setEditingChangeRequest(null);
        }}
        request={editingChangeRequest}
        scopeItems={project.scopeItems}
        quoteItems={quoteLineItems}
        onSave={handleUpdateChangeRequest}
        onDelete={handleDeleteChangeRequest}
      />

      <ApprovalModal
        isOpen={approvalModal.isOpen}
        onClose={() => setApprovalModal({ isOpen: false, action: 'approve', changeId: '', title: '' })}
        onConfirm={handleConfirmApproval}
        action={approvalModal.action}
        title={approvalModal.title}
      />

      {/* Regenerate Quote Link Confirmation Dialog */}
      <Dialog open={isRegenerateConfirmOpen} onOpenChange={setIsRegenerateConfirmOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto" data-testid="dialog-regenerate-quote-link">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Regenerate Quote Link?
            </DialogTitle>
            <DialogDescription>
              This will create a new quote link and <span className="font-medium text-foreground">permanently invalidate the current one</span>. Any client who already has the old link will no longer be able to access the quote.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsRegenerateConfirmOpen(false)}
              data-testid="button-regenerate-cancel"
            >
              Cancel
            </Button>
            <Button
              disabled={isRegeneratingToken}
              onClick={async () => {
                if (!activeQuote) return;
                setIsRegenerateConfirmOpen(false);
                setIsRegeneratingToken(true);
                const newToken = await regenerateQuoteToken(activeQuote.id);
                setIsRegeneratingToken(false);
                if (newToken) {
                  navigator.clipboard.writeText(getQuoteShareUrl(newToken));
                  toast.success('Quote link regenerated!', {
                    description: 'The old link is now invalid. The new link has been copied to your clipboard.',
                  });
                }
              }}
              data-testid="button-regenerate-confirm"
            >
              {isRegeneratingToken ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Yes, Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ChangeRequestItem({ request, onEdit, isNew, relatedItemTitle }: { request: ChangeRequest; onEdit?: () => void; isNew?: boolean; relatedItemTitle?: string }) {
  const typeConfig = {
    client_request: { icon: User, label: 'Client Request', color: 'text-primary' },
    site_issue: { icon: AlertTriangle, label: 'Site Issue', color: 'text-warning' },
    substitution: { icon: Package, label: 'Substitution', color: 'text-muted-foreground' },
    addition: { icon: Package, label: 'Addition', color: 'text-primary' },
  };

  const config = typeConfig[request.type];
  const Icon = config.icon;
  const isApproved = request.status === 'approved';

  return (
    <Card className={cn(
      "p-4 group overflow-hidden relative",
      request.status === 'pending' && "ring-2 ring-pending/30",
      isApproved && "border-approved/40 bg-approved/5"
    )}>
      {/* Green approved stripe along the left edge */}
      {isApproved && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-approved" />
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", config.color)} />
          <Badge variant="secondary" className="text-xs">{config.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {isNew && (
            <Badge variant="success" className="text-xs gap-1">
              <CheckCircle2 className="w-3 h-3" />
              New
            </Badge>
          )}
          {onEdit && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1">
        {isApproved && (
          <CheckCircle2 className="w-4 h-4 text-approved flex-shrink-0" />
        )}
        <h4 className="font-medium">{request.title}</h4>
      </div>
      {relatedItemTitle && <p className="text-sm text-muted-foreground mb-2">Related quote item: {relatedItemTitle}</p>}
      <p className="text-sm text-muted-foreground mb-3">{request.description}</p>

      {request.imageUrl && (
        <div className="mb-3">
          <ImageDisplay src={request.imageUrl} alt={request.title} className="max-w-[200px]" />
        </div>
      )}

      {/* Client's comment on this variation */}
      {request.resolutionComment && request.status !== 'pending' && request.status !== 'awaiting_client' && (
        <div className="mb-3 p-3 rounded-lg bg-secondary/60 border border-border/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Client's comment
          </p>
          <p className="text-sm">{request.resolutionComment}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded",
          request.costImpact > 0 ? "bg-warning/10 text-warning-foreground" :
          request.costImpact < 0 ? "bg-approved/10 text-approved" :
          "bg-secondary text-muted-foreground"
        )}>
          <DollarSign className="w-3.5 h-3.5" />
          {request.costImpact === 0 ? 'No cost change' :
           request.costImpact > 0 ? `+$${request.costImpact.toLocaleString()}` :
           `-$${Math.abs(request.costImpact).toLocaleString()}`}
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded",
          request.timeImpact > 0 ? "bg-warning/10 text-warning-foreground" :
          request.timeImpact < 0 ? "bg-approved/10 text-approved" :
          "bg-secondary text-muted-foreground"
        )}>
          <Clock className="w-3.5 h-3.5" />
          {request.timeImpact === 0 ? 'No delay' :
           request.timeImpact > 0 ? `+${request.timeImpact} days` :
           `${request.timeImpact} days`}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          {format(request.createdAt, 'MMM d, yyyy')}
        </div>
      </div>
    </Card>
  );
}
