import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, parseDefaultTerms } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { ImageDisplay } from '@/components/ImageUpload';
import { MultiImageDisplay } from '@/components/MultiImageUpload';
import { EditScopeItemModal } from '@/components/EditScopeItemModal';
import { SendChangeRequestModal } from '@/components/SendChangeRequestModal';
import { EditChangeRequestModal } from '@/components/EditChangeRequestModal';
import { RespondToClientModal } from '@/components/RespondToClientModal';
import { StageManager } from '@/components/StageManager';
import { DocumentsSection } from '@/components/DocumentsSection';
import { ApprovalModal } from '@/components/ApprovalModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QuoteSection } from '@/components/QuoteSection';
import { InvoiceSection } from '@/components/InvoiceSection';
import { useProject } from '@/hooks/useProject';
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuoteLineItems } from '@/hooks/useQuoteLineItems';
import { ChangeRequestCard } from '@/components/ChangeRequestCard';
import { ScopeItem, ChangeRequest, ProjectStage } from '@/types/project';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  ExternalLink, 
  Send, 
  Plus,
  Package,
  Ban,
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
  FileText,
  Receipt,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { cn, getClientProjectUrl, getQuoteShareUrl, cleanVariationTitle, isVariationItem } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
    updateClientDetails,
  } = useProject(id);

  const {
    activeQuote,
    createQuote,
    updateQuote,
    sendQuote,
    reviseQuote,
    regenerateQuoteToken,
  } = useQuotes(id);

  const {
    lineItems: quoteLineItems,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  } = useQuoteLineItems(activeQuote?.id);

  const {
    invoices,
    createInvoice,
    sendInvoice,
    markAsPaid,
    cancelInvoice,
    deleteInvoice,
  } = useInvoices(id);

  // Check for tab query param (e.g., from job creation)
  const initialTab = searchParams.get('tab') || 'quote';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editingScopeItem, setEditingScopeItem] = useState<ScopeItem | undefined>();
  const [isAddingScopeItem, setIsAddingScopeItem] = useState(false);
  const [isSendingChangeRequest, setIsSendingChangeRequest] = useState(false);
  const [editingChangeRequest, setEditingChangeRequest] = useState<ChangeRequest | null>(null);
  const [respondingToRequest, setRespondingToRequest] = useState<ChangeRequest | null>(null);
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'decline';
    changeId: string;
    title: string;
  }>({ isOpen: false, action: 'approve', changeId: '', title: '' });
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isRegeneratingToken, setIsRegeneratingToken] = useState(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editClientEmail, setEditClientEmail] = useState('');
  const [editClientAddress, setEditClientAddress] = useState('');
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    included: true,
    excluded: false,
    assumption: false,
  });
  const [defaultTerms, setDefaultTerms] = useState<string>('');
  const [defaultPaymentInstructions, setDefaultPaymentInstructions] = useState<string>('');
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
          <p className="text-muted-foreground mb-4">Project not found</p>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const categoryConfig = {
    included: { icon: Package, color: 'text-approved', bgColor: 'bg-approved/10', label: 'Included', subtle: false },
    excluded: { icon: Ban, color: 'text-muted-foreground', bgColor: 'bg-muted/30', label: 'Excluded', subtle: true },
    assumption: { icon: AlertTriangle, color: 'text-muted-foreground', bgColor: 'bg-muted/30', label: 'Assumption', subtle: true },
  };

  const toggleSection = (category: string) => {
    setExpandedSections(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleSaveScopeItem = async (itemData: Omit<ScopeItem, 'id' | 'acknowledged'> & { id?: string }) => {
    const success = await saveScopeItem(itemData);
    if (success) {
      toast.success(itemData.id ? 'Scope item updated' : 'Scope item added');
      setEditingScopeItem(undefined);
      setIsAddingScopeItem(false);
    }
  };

  const handleDeleteScopeItem = async (itemId: string) => {
    const success = await deleteScopeItem(itemId);
    if (success) {
      toast.success('Scope item deleted');
      setEditingScopeItem(undefined);
    }
  };

  const handleSendChangeRequest = async (requestData: Omit<ChangeRequest, 'id' | 'status' | 'createdAt' | 'resolvedAt'>) => {
    // Trade creating change request → notify client
    const success = await createChangeRequest(requestData, 'client');
    if (success) {
      toast.success('Variation sent to client');
      setIsSendingChangeRequest(false);
    }
  };

  const handleUpdateChangeRequest = async (requestData: ChangeRequest) => {
    const success = await updateChangeRequest(requestData);
    if (success) {
      toast.success('Variation updated');
      setEditingChangeRequest(null);
    }
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
    const invoiceId = await createInvoice({
      type: 'staged',
      quoteId: activeQuote?.id,
      stageId: stage.id,
      taxRate: activeQuote?.taxRate ?? 10,
      lineItems: [{
        description: `Stage Payment: ${stage.name}`,
        quantity: 1,
        unitPrice: amount / (1 + (activeQuote?.taxRate ?? 10) / 100), // Remove tax for subtotal
      }],
    });

    if (invoiceId) {
      toast.success(`Invoice created for "${stage.name}"`);
    }
  };

  const handleSendToClient = async () => {
    const success = await updateProjectStatus('sent');
    if (success) {
      toast.success('Project sent to client!');
    }
  };

  const handleCopyClientLink = () => {
    const link = getClientProjectUrl(project.id);
    navigator.clipboard.writeText(link);
    toast.success('Client page link copied!', {
      description: 'Share with your client for full transparency.'
    });
  };

  const handleSendInvite = () => {
    const link = getClientProjectUrl(project.id);
    navigator.clipboard.writeText(link);
    toast.success('Invite sent', {
      description: `${project.clientName} has been invited to ${project.name}.`,
    });
    setIsInviteModalOpen(false);
  };

  const handleOpenEditClient = () => {
    setEditClientName(project.clientName);
    setEditClientEmail(project.clientEmail);
    setEditClientAddress(project.clientAddress || '');
    setIsEditClientOpen(true);
  };

  const handleSaveClientDetails = async () => {
    if (!editClientName.trim() || !editClientEmail.trim()) return;
    setIsSavingClient(true);
    const success = await updateClientDetails({
      clientName: editClientName.trim(),
      clientEmail: editClientEmail.trim(),
      clientAddress: editClientAddress.trim() || undefined,
    });
    setIsSavingClient(false);
    if (success) setIsEditClientOpen(false);
  };

  // Separate pending changes into client requests (need trade response) and trade requests (awaiting client)
  const pendingClientRequests = project.changeRequests.filter(
    cr => cr.status === 'pending' && cr.type === 'client_request'
  );
  const pendingTradeRequests = project.changeRequests.filter(
    cr => (cr.status === 'pending' && cr.type !== 'client_request') || cr.status === 'awaiting_client'
  );
  const resolvedChanges = project.changeRequests.filter(cr => cr.status === 'approved' || cr.status === 'declined');
  // Variations resolved in the last 72 hours — shown with a "New" badge
  const RECENTLY_RESOLVED_MS = 72 * 60 * 60 * 1000;
  const recentlyResolvedChanges = resolvedChanges.filter(
    cr => cr.resolvedAt && (Date.now() - cr.resolvedAt.getTime()) < RECENTLY_RESOLVED_MS
  );

  const groupedScopeItems = {
    // Exclude variation items from the included list — they appear in the Approved Variations section
    included: project.scopeItems.filter(item => item.category === 'included' && !isVariationItem(item.title)),
    excluded: project.scopeItems.filter(item => item.category === 'excluded'),
    assumption: project.scopeItems.filter(item => item.category === 'assumption'),
  };

  return (
    <AppShell>
      {/* Project sub-header */}
      <div className="border-b border-zinc-200 bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" className="mt-0.5 flex-shrink-0" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-heading text-xl sm:text-2xl font-bold">{project.name}</h1>
                  <Badge variant={
                    project.status === 'draft' ? 'secondary' :
                    project.status === 'sent' ? 'pending' :
                    project.status === 'completed' ? 'success' : 'default'
                  }>
                    {project.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {project.clientName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {project.clientEmail}
                  </span>
                  {project.clientAddress && (
                    <span className="flex items-center gap-1" data-testid="text-client-address">
                      <MapPin className="w-3.5 h-3.5" />
                      {project.clientAddress}
                    </span>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={handleOpenEditClient}
                          data-testid="button-edit-client-details"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit client details</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setIsInviteModalOpen(true)}>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Invite Client to Project</span>
              </Button>
              {project.status === 'draft' && (
                <Button variant="accent" size="sm" onClick={handleSendToClient}>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Send to Client</span>
                </Button>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyClientLink}
                      data-testid="button-copy-client-link"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy preview link</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(getClientProjectUrl(project.id), '_blank', 'noopener,noreferrer')}
                      data-testid="button-preview-client-page"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Preview Client Page</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch] touch-pan-x overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
            <TabsList className="w-max sm:w-auto inline-flex flex-nowrap justify-start">
              <TabsTrigger value="quote">
                <FileText className="w-4 h-4 mr-1 hidden sm:block" />
                Quote
              </TabsTrigger>
              <TabsTrigger value="invoices">
                <Receipt className="w-4 h-4 mr-1 hidden sm:block" />
                Invoices
                {invoices.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {invoices.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="scope">
                Scope
                <Badge variant="secondary" className="ml-2">
                  {project.scopeItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="changes">
                Variations
                {pendingClientRequests.length > 0 && (
                  <Badge variant="pending" className="ml-2">
                    {pendingClientRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="stages">Stages</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
          </div>

          {/* Scope Tab */}
          <TabsContent value="scope" className="mt-0 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Project Scope</h2>
              <Button onClick={() => setIsAddingScopeItem(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

          {(['included', 'excluded', 'assumption'] as const).map((category) => {
              const items = groupedScopeItems[category];
              const config = categoryConfig[category];
              const Icon = config.icon;
              const isExpanded = expandedSections[category];
              
              return (
                <Card key={category} className={cn("overflow-hidden", config.subtle && "border-border")}>
                  <div 
                    className={cn(
                      "px-4 py-3 border-b flex items-center gap-2 cursor-pointer select-none transition-colors hover:bg-secondary/30",
                      config.bgColor
                    )}
                    onClick={() => toggleSection(category)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <Icon className={cn("w-5 h-5", config.color)} />
                    <h3 className={cn("font-heading font-semibold", config.subtle && "text-muted-foreground")}>{config.label}</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {items.length}
                    </Badge>
                  </div>
                  
                  {isExpanded && (
                    <>
                      {items.length === 0 ? (
                        <div className="p-6 text-center">
                          <p className="text-sm text-muted-foreground mb-3">No {config.label.toLowerCase()} items yet</p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setIsAddingScopeItem(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add {config.label} Item
                          </Button>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {items.map((item) => (
                            <div 
                              key={item.id}
                              className="p-4 hover:bg-secondary/30 transition-colors cursor-pointer group"
                              onClick={() => setEditingScopeItem(item)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium">{cleanVariationTitle(item.title)}</h4>
                                    {item.acknowledged && (
                                      <CheckCircle2 className="w-4 h-4 text-approved flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {item.description}
                                  </p>
                                  {item.imageUrls && item.imageUrls.length > 0 ? (
                                    <div className="mt-3">
                                      <MultiImageDisplay paths={item.imageUrls} />
                                    </div>
                                  ) : item.imageUrl ? (
                                    <div className="mt-3">
                                      <ImageDisplay src={item.imageUrl} alt={item.title} className="max-w-[200px]" />
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-3">
                                  {item.cost != null && item.cost > 0 && (
                                    <span className="text-primary font-medium whitespace-nowrap">
                                      ${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingScopeItem(item);
                                    }}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                    </>
                  )}
              </Card>
              );
            })}

            {project.scopeItems.length === 0 && (
              <Card className="p-12 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No scope items yet</p>
                <Button onClick={() => setIsAddingScopeItem(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Item
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes" className="mt-0 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Variations</h2>
              <Button onClick={() => setIsSendingChangeRequest(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Send Variation
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
              <Card className="p-12 text-center">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No variations yet</p>
                <Button onClick={() => setIsSendingChangeRequest(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Send First Variation
                </Button>
              </Card>
            ) : (
              <div className="space-y-8">
                {/* AWAITING RESPONSE — pending items only */}
                {(pendingClientRequests.length > 0 || pendingTradeRequests.length > 0) && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-base">Awaiting Response</h3>
                      <span className="text-xs font-medium bg-pending/15 text-pending-foreground px-2 py-0.5 rounded-full">
                        {pendingClientRequests.length + pendingTradeRequests.length}
                      </span>
                    </div>

                    {/* Client requests needing trade response */}
                    {pendingClientRequests.map((request) => (
                      <ChangeRequestCard
                        key={request.id}
                        request={request}
                        viewerRole="trade"
                        onRespond={handleRespondToClient}
                      />
                    ))}

                    {/* Trade requests awaiting client */}
                    {pendingTradeRequests.map((request) => (
                      <ChangeRequestItem
                        key={request.id}
                        request={request}
                        onEdit={() => setEditingChangeRequest(request)}
                      />
                    ))}
                  </div>
                )}

                {/* APPROVED */}
                {resolvedChanges.filter(cr => cr.status === 'approved').length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-base">Approved</h3>
                      <span className="text-xs font-medium bg-approved/15 text-approved px-2 py-0.5 rounded-full">
                        {resolvedChanges.filter(cr => cr.status === 'approved').length}
                      </span>
                    </div>
                    {recentlyResolvedChanges.filter(cr => cr.status === 'approved').length > 0 && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-approved/10 border border-approved/20">
                        <CheckCircle2 className="w-4 h-4 text-approved flex-shrink-0" />
                        <p className="text-sm text-approved font-medium">
                          {recentlyResolvedChanges.filter(cr => cr.status === 'approved').length} variation{recentlyResolvedChanges.filter(cr => cr.status === 'approved').length > 1 ? 's' : ''} approved in the last 72 hours — both parties notified by email.
                        </p>
                      </div>
                    )}
                    {resolvedChanges.filter(cr => cr.status === 'approved').map((request) => (
                      <ChangeRequestItem
                        key={request.id}
                        request={request}
                        onEdit={() => setEditingChangeRequest(request)}
                        isNew={recentlyResolvedChanges.some(r => r.id === request.id)}
                      />
                    ))}
                  </div>
                )}

                {/* DECLINED */}
                {resolvedChanges.filter(cr => cr.status === 'declined').length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-base">Declined</h3>
                      <span className="text-xs font-medium bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">
                        {resolvedChanges.filter(cr => cr.status === 'declined').length}
                      </span>
                    </div>
                    {resolvedChanges.filter(cr => cr.status === 'declined').map((request) => (
                      <ChangeRequestItem
                        key={request.id}
                        request={request}
                        onEdit={() => setEditingChangeRequest(request)}
                        isNew={recentlyResolvedChanges.some(r => r.id === request.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Quote Tab */}
          <TabsContent value="quote" className="mt-0 space-y-4">
            {activeQuote?.quoteToken && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getQuoteShareUrl(activeQuote.quoteToken));
                      toast.success('Quote link copied!', {
                        description: 'Send this link to your client so they can review and accept the quote.',
                      });
                    }}
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
              onAddLineItem={addLineItem}
              onUpdateLineItem={updateLineItem}
              onDeleteLineItem={deleteLineItem}
              onCreateQuote={createQuote}
              onUpdateQuote={updateQuote}
              onSendQuote={sendQuote}
              onReviseQuote={reviseQuote}
            />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-0">
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
              onSendInvoice={sendInvoice}
              onMarkAsPaid={markAsPaid}
              onCancelInvoice={cancelInvoice}
              onDeleteInvoice={deleteInvoice}
            />
          </TabsContent>

          {/* Stages Tab */}
          <TabsContent value="stages" className="mt-0">
            <StageManager
              stages={project.stages}
              currentStageIndex={project.currentStageIndex}
              invoices={invoices}
              quote={activeQuote}
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
          <TabsContent value="documents" className="mt-0">
            <DocumentsSection
              projectId={project.id}
              documents={documents}
              onRefresh={refetch}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      <EditScopeItemModal
        open={isAddingScopeItem || !!editingScopeItem}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddingScopeItem(false);
            setEditingScopeItem(undefined);
          }
        }}
        item={editingScopeItem}
        onSave={handleSaveScopeItem}
        onDelete={editingScopeItem ? handleDeleteScopeItem : undefined}
      />

      <SendChangeRequestModal
        open={isSendingChangeRequest}
        onOpenChange={setIsSendingChangeRequest}
        onSend={handleSendChangeRequest}
        scopeItems={project.scopeItems}
      />

      <EditChangeRequestModal
        open={!!editingChangeRequest}
        onOpenChange={(open) => {
          if (!open) setEditingChangeRequest(null);
        }}
        request={editingChangeRequest}
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

      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-invite-client">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Invite Client to Project
            </DialogTitle>
            <DialogDescription>
              We'll send your client a private link to their live project page where they can review the scope, approve variations and follow progress.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="font-medium" data-testid="text-invite-project-name">{project.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium" data-testid="text-invite-client-name">{project.clientName}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Mail className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium break-all" data-testid="text-invite-client-email">{project.clientEmail}</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              They'll receive an invitation to view <span className="font-medium text-foreground">{project.name}</span>, approve the scope of work, raise variations and track progress in real time.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsInviteModalOpen(false)}
              data-testid="button-invite-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvite}
              data-testid="button-invite-send"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Details Dialog */}
      <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-client">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Edit Client Details
            </DialogTitle>
            <DialogDescription>
              Update the client's name, email, or address. Changes will appear on all new PDFs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-client-name">Name</Label>
              <Input
                id="edit-client-name"
                value={editClientName}
                onChange={e => setEditClientName(e.target.value)}
                placeholder="Client name"
                data-testid="input-edit-client-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-email">Email</Label>
              <Input
                id="edit-client-email"
                type="email"
                value={editClientEmail}
                onChange={e => setEditClientEmail(e.target.value)}
                placeholder="client@email.com"
                data-testid="input-edit-client-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-address">
                Address <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="edit-client-address"
                value={editClientAddress}
                onChange={e => setEditClientAddress(e.target.value)}
                placeholder="e.g., 12 Main St, Sydney NSW 2000"
                className="min-h-[60px]"
                data-testid="input-edit-client-address"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditClientOpen(false)}
              data-testid="button-edit-client-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveClientDetails}
              disabled={isSavingClient || !editClientName.trim() || !editClientEmail.trim()}
              data-testid="button-edit-client-save"
            >
              {isSavingClient ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Quote Link Confirmation Dialog */}
      <Dialog open={isRegenerateConfirmOpen} onOpenChange={setIsRegenerateConfirmOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-regenerate-quote-link">
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

function ChangeRequestItem({ request, onEdit, isNew }: { request: ChangeRequest; onEdit?: () => void; isNew?: boolean }) {
  const typeConfig = {
    client_request: { icon: User, label: 'Client Request', color: 'text-primary' },
    site_issue: { icon: AlertTriangle, label: 'Site Issue', color: 'text-warning' },
    substitution: { icon: Package, label: 'Substitution', color: 'text-muted-foreground' },
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
