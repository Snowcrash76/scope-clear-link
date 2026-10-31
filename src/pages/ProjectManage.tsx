import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
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
import { LoadErrorState } from '@/components/LoadErrorState';
import { Skeleton } from '@/components/ui/skeleton';
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
import { buildQuoteInvoice, type QuoteInvoiceAllocation } from '@/lib/quoteInvoice';
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
import { awaitingClientApproval, needsTradeResponse } from '@/lib/variationStatus';
import { ProjectManageHeader } from '@/components/project-manage/ProjectManageHeader';
import { ProjectManageNotifications } from '@/components/project-manage/ProjectManageNotifications';
import { ProjectVariationsTabContent } from '@/components/project-manage/ProjectVariationsTabContent';
import { ProjectActivityContent, type ProjectActivityEvent } from '@/components/project-manage/ProjectActivityContent';
import { ProjectOverview } from '@/components/project-manage/ProjectOverview';
import type { ClientEditValues } from '@/components/project-manage/ClientDetailsCard';

function ProjectManageContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const {
    project,
    documents,
    loading,
    error: projectLoadError,
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
    updateClientDetails,
  } = useProject(id);
  const { createProject } = useCreateProject();

  const {
    activeQuote,
    loading: quotesLoading,
    error: quotesError,
    refetch: refetchQuotes,
    createQuote,
    updateQuote,
    sendQuote,
    approveQuote,
    reviseQuote,
    regenerateQuoteToken,
  } = useQuotes(id);

  const {
    lineItems: quoteLineItems,
    loading: quoteLineItemsLoading,
    error: quoteLineItemsError,
    refetch: refetchQuoteLineItems,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  } = useQuoteLineItems(activeQuote?.id);

  const {
    history: lineItemHistory,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useLineItemHistory(activeQuote?.id);

  const {
    invoices,
    loading: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices,
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

  // Check for tab query param (e.g., from job creation or dashboard attention).
  const rawTab = searchParams.get('tab') || 'overview';
  const initialTab = ['scope', 'variations', 'changes'].includes(rawTab)
    ? 'changes'
    : rawTab;
  const targetVariationId = searchParams.get('variation');
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    if (searchParams.get('client') === 'edit') setClientEditOpen(true);
  }, [searchParams]);
  useEffect(() => {
    const variationId = searchParams.get('variation');
    if (activeTab !== 'changes' || !variationId || !project) return;
    const timeout = window.setTimeout(() => {
      const target = document.getElementById(`variation-${variationId}`);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeTab, project?.changeRequests.length, searchParams]);
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
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [defaultTerms, setDefaultTerms] = useState<string>('');
  const [defaultQuoteTerms, setDefaultQuoteTerms] = useState<string>('');
  const [defaultPaymentInstructions, setDefaultPaymentInstructions] = useState<string>('');
  // Dismissed attention notice state — persisted per project in localStorage
  const [dismissedActionCount, setDismissedActionCount] = useState<number>(() => {
    if (!id) return -1;
    const v = localStorage.getItem(`notif-action-required-${id}`);
    return v !== null ? parseInt(v, 10) : -1;
  });

  useEffect(() => {
    if (activeTab !== 'changes' || !targetVariationId || !project?.changeRequests.some(request => request.id === targetVariationId)) return;
    const target = document.getElementById(`variation-${targetVariationId}`);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeTab, targetVariationId, project?.changeRequests]);

  // Rehydrate dismiss state if the project ID changes without a full remount
  useEffect(() => {
    if (!id) return;
    const actionVal = localStorage.getItem(`notif-action-required-${id}`);
    setDismissedActionCount(actionVal !== null ? parseInt(actionVal, 10) : -1);
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
      <AppShell>
        <PageLayout title="Loading job" description="Getting the latest saved details.">
          <div className="space-y-5" aria-label="Loading job details">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </PageLayout>
      </AppShell>
    );
  }

  if (projectLoadError) {
    return (
      <AppShell>
        <PageLayout title="Job unavailable" description="The saved job details could not be loaded.">
          <LoadErrorState title="Could not load this job" description="This is a loading error, not an empty or missing job. Retry to fetch its saved data." onRetry={refetch} />
        </PageLayout>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <PageLayout title="Job not found" description="This job may have been removed or the link may be incorrect.">
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center">
            <p className="text-sm text-zinc-800">No saved job exists at this address.</p>
            <Button variant="outline" className="mt-4 min-h-11" onClick={() => navigate('/projects')}>Return to Jobs</Button>
          </div>
        </PageLayout>
      </AppShell>
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

  const handleCreateQuoteInvoice = async (quoteId: string, allocation?: QuoteInvoiceAllocation) => {
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
    try {
      const invoiceId = await createInvoice(buildQuoteInvoice(activeQuote, allocation, lineItems));
      if (invoiceId) setActiveTab('invoices');
      return !!invoiceId;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create the invoice.');
      return false;
    }
  };

  const handleSaveClientDetails = async (values: ClientEditValues, applyToAll: boolean) => {
    if (!applyToAll) {
      return updateClientDetails({
        clientName: values.clientName,
        clientEmail: values.clientEmail,
        clientAddress: values.clientAddress,
      });
    }
    try {
      const { data: rows, error: lookupError } = await supabase
        .from('projects')
        .select('id, client_name, client_email');
      if (lookupError) throw lookupError;
      const clientKey = project.clientEmail.trim().toLowerCase() || project.clientName.trim().toLowerCase();
      const projectIds = (rows ?? [])
        .filter((row) => (row.client_email ?? '').trim().toLowerCase() || (row.client_name ?? '').trim().toLowerCase())
        .filter((row) => ((row.client_email ?? '').trim().toLowerCase() || (row.client_name ?? '').trim().toLowerCase()) === clientKey)
        .map((row) => row.id);
      if (!projectIds.includes(project.id)) projectIds.push(project.id);
      const { error } = await supabase.from('projects').update({
        client_name: values.clientName,
        client_email: values.clientEmail,
        client_address: values.clientAddress || null,
      }).in('id', projectIds);
      if (error) throw error;
      await refetch();
      toast.success(`Client details updated on ${projectIds.length} job${projectIds.length === 1 ? '' : 's'}`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update client details');
      return false;
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
  return (
    <AppShell>
      <ProjectManageHeader
        project={project}
        activeQuote={activeQuote}
        onTabChange={setActiveTab}
        pendingVariationCount={pendingClientRequests.length + project.changeRequests.filter(awaitingClientApproval).length}
        isDuplicating={isDuplicating}
        onBack={() => navigate('/projects')}
        onAddVariation={() => setIsSendingChangeRequest(true)}
        onDuplicateProject={handleDuplicateProject}
        onSaveClient={handleSaveClientDetails}
        onAddClientEmail={() => setClientEditOpen(true)}
        onClientPageSent={refetch}
        clientEditOpen={clientEditOpen}
        onClientEditOpenChange={setClientEditOpen}
        onUpdateProjectStatus={updateProjectStatus}
      />

      <PageLayout headerless className="!pt-0 !pb-6">
        <div className="grid min-w-0 grid-cols-1 gap-5">
          <JobSectionMenu
            value={activeTab}
            onValueChange={setActiveTab}
            invoiceCount={invoices.filter((invoice) => invoice.status === 'overdue').length}
            pendingVariationCount={pendingClientRequests.length + project.changeRequests.filter(awaitingClientApproval).length}
            needsTradeResponseCount={pendingClientRequests.length}
          />
          <ProjectManageNotifications
            showActionRequired={showActionRequired}
            pendingClientRequestCount={pendingClientRequests.length}
            overdueInvoiceCount={invoices.filter((invoice) => invoice.status === 'overdue').length}
            onDismissActionRequired={dismissActionRequired}
            activeTab={activeTab}
            onNavigate={setActiveTab}
          />
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
          <TabsContent value="overview" className="mt-0" role="region" aria-label="Overview">
            <ProjectOverview
              project={project}
              documents={documents}
              overdueInvoiceCount={invoices.filter((invoice) => invoice.status === 'overdue').length}
              quoteSubtotal={activeQuote?.subtotal ?? null}
              quoteLoading={quotesLoading}
              quoteError={Boolean(quotesError)}
              quoteExists={Boolean(activeQuote)}
              quoteWaitingOnClient={activeQuote?.status === 'sent'}
              onChangeTab={setActiveTab}
            />
          </TabsContent>
          <TabsContent value="costs" className="mt-0" role="region" aria-labelledby={undefined} aria-label="Costs">
            <JobCostsTab jobId={project.id} />
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes" className="mt-0 space-y-6" role="region" aria-labelledby={undefined} aria-label="Variations">
            <ProjectVariationsTabContent
              project={project}
              activeQuote={activeQuote}
              quoteLineItems={quoteLineItems}
              recentlyResolvedChanges={recentlyResolvedChanges}
              respondingToRequest={respondingToRequest}
              onAddVariation={() => setIsSendingChangeRequest(true)}
              onCloseResponse={() => setRespondingToRequest(null)}
              onSubmitResponse={handleSubmitResponse}
              onRespondToClient={handleRespondToClient}
              onEditChangeRequest={setEditingChangeRequest}
            />
          </TabsContent>

          {/* Quote Tab */}
          <TabsContent value="quote" className="mt-0 min-w-0 space-y-4" role="region" aria-labelledby={undefined} aria-label="Quote">
            {quotesLoading || quoteLineItemsLoading ? (
              <div className="space-y-4" aria-label="Loading quote">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-56 w-full rounded-xl" />
              </div>
            ) : quotesError || quoteLineItemsError ? (
              <LoadErrorState
                title="Quote details could not be loaded"
                description="A failed quote or line-item request is not an empty quote. Retry to reload the saved data."
                onRetry={() => Promise.all([refetchQuotes(), refetchQuoteLineItems()])}
              />
            ) : <>
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
              onCreateInvoice={handleCreateQuoteInvoice}
              onReviseQuote={reviseQuote}
              onSaveScopeItem={handleSaveScopeItem}
              onDeleteScopeItem={handleDeleteScopeItem}
              onOpenVariations={() => setActiveTab('changes')}
            />
            </>}
          </TabsContent>

          <TabsContent value="activity" className="mt-0" role="region" aria-labelledby={undefined} aria-label="Activity">
            <ProjectActivityContent
              activityEvents={activityEvents as ProjectActivityEvent[]}
              isLoading={historyLoading}
              hasError={Boolean(historyError)}
              onRetry={refetchHistory}
            />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-0" role="region" aria-labelledby={undefined} aria-label="Invoices">
            {invoicesLoading ? (
              <div className="space-y-4" aria-label="Loading invoices">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : invoicesError ? (
              <LoadErrorState title="Invoices could not be loaded" description="A failed invoice request is not an empty invoice list." onRetry={refetchInvoices} />
            ) : <InvoiceSection
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
            />}
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
            <nav className="mb-4 flex gap-2" aria-label="Team views">
              <Button variant={activeTab === 'staff' ? 'accent' : 'outline'} className="min-h-11" onClick={() => setActiveTab('staff')}>Assignments</Button>
              <Button variant={activeTab === 'employee-updates' ? 'accent' : 'outline'} className="min-h-11" onClick={() => setActiveTab('employee-updates')}>Team updates</Button>
            </nav>
            <TeamHome panel="staff" embedded />
          </TabsContent>
          <TabsContent value="employee-updates" className="mt-0" role="region" aria-label="Employee updates">
            <nav className="mb-4 flex gap-2" aria-label="Team views">
              <Button variant={activeTab === 'staff' ? 'accent' : 'outline'} className="min-h-11" onClick={() => setActiveTab('staff')}>Assignments</Button>
              <Button variant={activeTab === 'employee-updates' ? 'accent' : 'outline'} className="min-h-11" onClick={() => setActiveTab('employee-updates')}>Team updates</Button>
            </nav>
            <TeamHome panel="updates" embedded />
          </TabsContent>
          </Tabs>
        </div>
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

export default function ProjectManage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  if (searchParams.get('tab') === 'timesheets') {
    return <Navigate to={`/team/timesheets?job=${encodeURIComponent(id ?? '')}`} replace />;
  }
  return <ProjectManageContent />;
}
