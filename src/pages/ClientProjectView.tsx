import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ActionRequired } from '@/components/ActionRequired';
import { ScopeSection } from '@/components/ScopeSection';
import { ChangeRequestCard } from '@/components/ChangeRequestCard';
import { ProjectTimeline } from '@/components/ProjectTimeline';
import { RequestChangeButton } from '@/components/RequestChangeButton';
import { ClientDocumentsSection } from '@/components/ClientDocumentsSection';
import { ApprovalModal } from '@/components/ApprovalModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { useProject } from '@/hooks/useProject';
import { toast } from 'sonner';
import { Package, RefreshCw, TrendingUp, FileText, Loader2, Calculator } from 'lucide-react';

export default function ClientProjectView() {
  const { id } = useParams();
  const {
    project,
    documents,
    loading,
    acknowledgeScopeItem,
    createChangeRequest,
    updateChangeRequestStatus,
  } = useProject(id);

  // Move useState to top before any conditional returns (React hooks rule)
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'decline';
    changeId: string;
    title: string;
  }>({ isOpen: false, action: 'approve', changeId: '', title: '' });

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
          <h1 className="text-2xl font-bold text-foreground">Project Not Found</h1>
          <p className="text-muted-foreground mt-2">The project you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const includedItems = project.scopeItems.filter(item => item.category === 'included');
  const excludedItems = project.scopeItems.filter(item => item.category === 'excluded');
  const assumptionItems = project.scopeItems.filter(item => item.category === 'assumption');
  const unacknowledgedItems = project.scopeItems.filter(item => !item.acknowledged);

  const pendingChanges = project.changeRequests.filter(cr => cr.status === 'pending');
  const resolvedChanges = project.changeRequests.filter(cr => cr.status !== 'pending');

  const handleAcknowledge = async (itemId: string) => {
    const success = await acknowledgeScopeItem(itemId, true);
    if (success) {
      toast.success('Item acknowledged');
    }
  };

  const handleApproveChange = (changeId: string) => {
    const change = project.changeRequests.find(c => c.id === changeId);
    setApprovalModal({
      isOpen: true,
      action: 'approve',
      changeId,
      title: change?.title || 'Change Request',
    });
  };

  const handleDeclineChange = (changeId: string) => {
    const change = project.changeRequests.find(c => c.id === changeId);
    setApprovalModal({
      isOpen: true,
      action: 'decline',
      changeId,
      title: change?.title || 'Change Request',
    });
  };

  const handleConfirmApproval = async (comment: string) => {
    const { action, changeId } = approvalModal;
    const success = await updateChangeRequestStatus(changeId, action === 'approve' ? 'approved' : 'declined', 'trade', comment);
    if (success) {
      toast.success(action === 'approve' 
        ? 'Change approved! Your trade has been notified.' 
        : 'Change declined. Your trade has been notified.');
    }
    setApprovalModal({ isOpen: false, action: 'approve', changeId: '', title: '' });
  };

  const handleRequestChange = async (description: string, imageUrl?: string) => {
    // Client creating change request → notify trade
    const success = await createChangeRequest({
      type: 'client_request',
      title: 'New change request',
      description,
      costImpact: 0,
      timeImpact: 0,
      imageUrl,
    }, 'trade');
    
    if (success) {
      toast.success('Change request sent! Your trade will review and respond.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader project={project} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Action Required Banner */}
        <ActionRequired 
          pendingChanges={pendingChanges}
          unacknowledgedItems={unacknowledgedItems}
          viewerRole="client"
        />

        {/* Main Content Tabs */}
        <Tabs defaultValue="scope" className="space-y-6">
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
            <TabsTrigger value="scope" className="gap-2">
              <Package className="w-4 h-4 hidden sm:block" />
              Scope
            </TabsTrigger>
            <TabsTrigger value="changes" className="gap-2">
              <RefreshCw className="w-4 h-4 hidden sm:block" />
              Changes
              {pendingChanges.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-pending text-pending-foreground">
                  {pendingChanges.length}
                </span>
              )}
            </TabsTrigger>
            {documents.length > 0 && (
              <TabsTrigger value="documents" className="gap-2">
                <FileText className="w-4 h-4 hidden sm:block" />
                Docs
              </TabsTrigger>
            )}
            <TabsTrigger value="progress" className="gap-2">
              <TrendingUp className="w-4 h-4 hidden sm:block" />
              Progress
            </TabsTrigger>
          </TabsList>

          {/* Scope Tab */}
          <TabsContent value="scope" className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold">Project Scope</h2>
                <p className="text-sm text-muted-foreground">
                  Please review and acknowledge each section below
                </p>
              </div>
            </div>

            <ScopeSection
              title="What's Included"
              description="Work and materials covered in your quote"
              category="included"
              items={includedItems}
              onAcknowledge={handleAcknowledge}
            />

            <ScopeSection
              title="What's Not Included"
              description="Items outside the scope of this project"
              category="excluded"
              items={excludedItems}
              onAcknowledge={handleAcknowledge}
            />

            <ScopeSection
              title="Our Assumptions"
              description="Conditions we're expecting — if different, we'll discuss"
              category="assumption"
              items={assumptionItems}
              onAcknowledge={handleAcknowledge}
            />

            {/* Total Quote Summary */}
            {(() => {
              const totalQuote = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
              if (totalQuote > 0) {
                return (
                  <Card className="p-4 sm:p-5 bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Calculator className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-heading font-semibold text-lg">Total Quote Amount</h3>
                          <p className="text-sm text-muted-foreground">Sum of all included items</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-primary">
                        ${totalQuote.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </Card>
                );
              }
              return null;
            })()}
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes" className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold">Changes & Variations</h2>
                <p className="text-sm text-muted-foreground">
                  Track all modifications to the original scope
                </p>
              </div>
              <RequestChangeButton onSubmit={handleRequestChange} />
            </div>

            {project.changeRequests.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No changes requested yet.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {project.changeRequests.map(request => (
                  <ChangeRequestCard
                    key={request.id}
                    request={request}
                    viewerRole="client"
                    onApprove={handleApproveChange}
                    onDecline={handleDeclineChange}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          {documents.length > 0 && (
            <TabsContent value="documents" className="space-y-4 animate-fade-in">
              <ClientDocumentsSection documents={documents} />
            </TabsContent>
          )}

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Project Progress</h2>
              <p className="text-sm text-muted-foreground">
                See where your project is at and what's coming next
              </p>
            </div>

            <Card className="p-4 sm:p-6">
              <ProjectTimeline 
                stages={project.stages} 
                currentStageIndex={project.currentStageIndex}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={approvalModal.isOpen}
        onClose={() => setApprovalModal({ isOpen: false, action: 'approve', changeId: '', title: '' })}
        onConfirm={handleConfirmApproval}
        action={approvalModal.action}
        title={approvalModal.title}
      />

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-muted-foreground">
          <p>This project page is provided by {project.tradeBusinessName}</p>
          <p className="mt-1">Questions? Contact {project.tradeName} directly.</p>
        </div>
      </footer>
    </div>
  );
}
