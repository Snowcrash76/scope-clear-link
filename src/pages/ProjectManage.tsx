import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { ImageDisplay } from '@/components/ImageUpload';
import { MultiImageDisplay } from '@/components/MultiImageUpload';
import { EditScopeItemModal } from '@/components/EditScopeItemModal';
import { SendChangeRequestModal } from '@/components/SendChangeRequestModal';
import { EditChangeRequestModal } from '@/components/EditChangeRequestModal';
import { StageManager } from '@/components/StageManager';
import { DocumentsSection } from '@/components/DocumentsSection';
import { ApprovalModal } from '@/components/ApprovalModal';
import { useProject } from '@/hooks/useProject';
import { ChangeRequestCard } from '@/components/ChangeRequestCard';
import { ScopeItem, ChangeRequest } from '@/types/project';
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
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2,
  Copy,
  Loader2,
  Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ProjectManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
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
    updateStage,
    updateProjectStatus,
  } = useProject(id);

  const [activeTab, setActiveTab] = useState('scope');
  const [editingScopeItem, setEditingScopeItem] = useState<ScopeItem | undefined>();
  const [isAddingScopeItem, setIsAddingScopeItem] = useState(false);
  const [isSendingChangeRequest, setIsSendingChangeRequest] = useState(false);
  const [editingChangeRequest, setEditingChangeRequest] = useState<ChangeRequest | null>(null);
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'decline';
    changeId: string;
    title: string;
  }>({ isOpen: false, action: 'approve', changeId: '', title: '' });

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
    included: { icon: Package, color: 'text-approved', bgColor: 'bg-approved/10', label: 'Included' },
    excluded: { icon: Ban, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Excluded' },
    assumption: { icon: AlertTriangle, color: 'text-pending-foreground', bgColor: 'bg-pending/10', label: 'Assumption' },
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
      toast.success('Change request sent to client');
      setIsSendingChangeRequest(false);
    }
  };

  const handleUpdateChangeRequest = async (requestData: ChangeRequest) => {
    const success = await updateChangeRequest(requestData);
    if (success) {
      toast.success('Change request updated');
      setEditingChangeRequest(null);
    }
  };

  const handleDeleteChangeRequest = async (requestId: string) => {
    const success = await deleteChangeRequest(requestId);
    if (success) {
      toast.success('Change request deleted');
      setEditingChangeRequest(null);
    }
  };

  const handleApproveClientRequest = (requestId: string) => {
    const change = project.changeRequests.find(c => c.id === requestId);
    setApprovalModal({
      isOpen: true,
      action: 'approve',
      changeId: requestId,
      title: change?.title || 'Client Request',
    });
  };

  const handleDeclineClientRequest = (requestId: string) => {
    const change = project.changeRequests.find(c => c.id === requestId);
    setApprovalModal({
      isOpen: true,
      action: 'decline',
      changeId: requestId,
      title: change?.title || 'Client Request',
    });
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

  const handleSendToClient = async () => {
    const success = await updateProjectStatus('sent');
    if (success) {
      toast.success('Project sent to client!');
    }
  };

  const handleCopyClientLink = () => {
    const link = `${window.location.origin}/project/${project.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Client link copied to clipboard');
  };

  // Separate pending changes into client requests (need trade approval) and trade requests (awaiting client)
  const pendingClientRequests = project.changeRequests.filter(
    cr => cr.status === 'pending' && cr.type === 'client_request'
  );
  const pendingTradeRequests = project.changeRequests.filter(
    cr => cr.status === 'pending' && cr.type !== 'client_request'
  );
  const resolvedChanges = project.changeRequests.filter(cr => cr.status !== 'pending');

  const groupedScopeItems = {
    included: project.scopeItems.filter(item => item.category === 'included'),
    excluded: project.scopeItems.filter(item => item.category === 'excluded'),
    assumption: project.scopeItems.filter(item => item.category === 'assumption'),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-heading text-xl sm:text-2xl font-bold">{project.name}</h1>
                  <Badge variant={
                    project.status === 'draft' ? 'secondary' :
                    project.status === 'sent' ? 'pending' :
                    project.status === 'completed' ? 'success' : 'default'
                  }>
                    {project.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {project.clientName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {project.clientEmail}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyClientLink}>
                <Copy className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Copy Link</span>
              </Button>
              {project.status === 'draft' && (
                <Button variant="accent" size="sm" onClick={handleSendToClient}>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Send to Client</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" asChild>
                <Link to={`/project/${project.id}`} target="_blank">
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="scope">
              Scope
              <Badge variant="secondary" className="ml-2">
                {project.scopeItems.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="changes">
              Changes
              {pendingClientRequests.length > 0 && (
                <Badge variant="pending" className="ml-2">
                  {pendingClientRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="stages">Stages</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

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

              return (
                <Card key={category} className="overflow-hidden">
                  <div className={cn("px-4 py-3 border-b flex items-center gap-2", config.bgColor)}>
                    <Icon className={cn("w-5 h-5", config.color)} />
                    <h3 className="font-heading font-semibold">{config.label}</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {items.length}
                    </Badge>
                  </div>
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
                                <h4 className="font-medium">{item.title}</h4>
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
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingScopeItem(item);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </Card>
              );
            })}

            {/* Total Quote Summary for Trade View */}
            {(() => {
              const totalQuote = groupedScopeItems.included.reduce((sum, item) => sum + (item.cost || 0), 0);
              if (totalQuote > 0) {
                return (
                  <Card className="p-4 bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Calculator className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-heading font-semibold">Total Quote Amount</h3>
                          <p className="text-sm text-muted-foreground">Sum of all included items</p>
                        </div>
                      </div>
                      <span className="text-xl font-bold text-primary">
                        ${totalQuote.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </Card>
                );
              }
              return null;
            })()}

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
              <h2 className="font-heading text-lg font-semibold">Change Requests</h2>
              <Button onClick={() => setIsSendingChangeRequest(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Send Change Request
              </Button>
            </div>

            {pendingClientRequests.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Client Requests - Needs Your Response ({pendingClientRequests.length})
                </h3>
                {pendingClientRequests.map((request) => (
                  <ChangeRequestCard
                    key={request.id}
                    request={request}
                    viewerRole="trade"
                    onApprove={handleApproveClientRequest}
                    onDecline={handleDeclineClientRequest}
                  />
                ))}
              </div>
            )}

            {pendingTradeRequests.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Awaiting Client Response ({pendingTradeRequests.length})
                </h3>
                {pendingTradeRequests.map((request) => (
                  <ChangeRequestItem 
                    key={request.id} 
                    request={request} 
                    onEdit={() => setEditingChangeRequest(request)}
                  />
                ))}
              </div>
            )}

            {resolvedChanges.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Resolved ({resolvedChanges.length})
                </h3>
                {resolvedChanges.map((request) => (
                  <ChangeRequestItem 
                    key={request.id} 
                    request={request} 
                    onEdit={() => setEditingChangeRequest(request)}
                  />
                ))}
              </div>
            )}

            {project.changeRequests.length === 0 && pendingClientRequests.length === 0 && pendingTradeRequests.length === 0 && (
              <Card className="p-12 text-center">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No change requests yet</p>
                <Button onClick={() => setIsSendingChangeRequest(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Send First Change Request
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* Stages Tab */}
          <TabsContent value="stages" className="mt-0">
            <StageManager
              stages={project.stages}
              currentStageIndex={project.currentStageIndex}
              onUpdateStage={handleUpdateStage}
              onSetCurrentStage={handleSetCurrentStage}
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
    </div>
  );
}

function ChangeRequestItem({ request, onEdit }: { request: ChangeRequest; onEdit?: () => void }) {
  const typeConfig = {
    client_request: { icon: User, label: 'Client Request', color: 'text-primary' },
    site_issue: { icon: AlertTriangle, label: 'Site Issue', color: 'text-warning' },
    substitution: { icon: Package, label: 'Substitution', color: 'text-muted-foreground' },
  };

  const config = typeConfig[request.type];
  const Icon = config.icon;

  return (
    <Card className={cn(
      "p-4 group",
      request.status === 'pending' && "ring-2 ring-pending/30"
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", config.color)} />
          <Badge variant="secondary" className="text-xs">{config.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
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

      <h4 className="font-medium mb-1">{request.title}</h4>
      <p className="text-sm text-muted-foreground mb-3">{request.description}</p>

      {request.imageUrl && (
        <div className="mb-3">
          <ImageDisplay src={request.imageUrl} alt={request.title} className="max-w-[200px]" />
        </div>
      )}

      {/* Resolution Comment */}
      {request.resolutionComment && request.status !== 'pending' && (
        <div className="mb-3 p-3 rounded-lg bg-secondary/50">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">
              {request.status === 'approved' ? 'Approval' : 'Decline'} comment:
            </span>{' '}
            {request.resolutionComment}
          </p>
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
