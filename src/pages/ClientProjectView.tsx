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
import { QuoteViewModal } from '@/components/QuoteViewModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProject } from '@/hooks/useProject';
import { useQuotes } from '@/hooks/useQuotes';
import { toast } from 'sonner';
import { Package, RefreshCw, TrendingUp, FileText, Loader2, Calculator, Download, Eye, Receipt, FolderOpen } from 'lucide-react';
import { downloadQuotePDF } from '@/lib/quotePdf';

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
  
  const { activeQuote } = useQuotes(id);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

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
        <Tabs defaultValue="quote" className="space-y-6">
          <TabsList className="w-full sm:w-auto grid grid-cols-6 sm:inline-flex">
            <TabsTrigger value="quote" className="gap-2">
              <FileText className="w-4 h-4 hidden sm:block" />
              Quote
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <Receipt className="w-4 h-4 hidden sm:block" />
              Invoices
            </TabsTrigger>
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
            <TabsTrigger value="stages" className="gap-2">
              <TrendingUp className="w-4 h-4 hidden sm:block" />
              Stages
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FolderOpen className="w-4 h-4 hidden sm:block" />
              Documents
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

          {/* Quote Tab */}
          <TabsContent value="quote" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Quote Details</h2>
              <p className="text-sm text-muted-foreground">
                Review and download your quote
              </p>
            </div>

            {activeQuote && activeQuote.status !== 'draft' ? (
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{activeQuote.quoteNumber}</h3>
                    <p className="text-sm text-muted-foreground">
                      Total: ${activeQuote.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsQuoteModalOpen(true)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                    <Button onClick={() => {
                      try {
                        downloadQuotePDF(
                          activeQuote,
                          {
                            name: project.name,
                            clientName: project.clientName,
                            clientEmail: project.clientEmail,
                            tradeBusinessName: project.tradeBusinessName,
                            tradeName: project.tradeName,
                          },
                          project.scopeItems,
                          project.changeRequests
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
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No quote available yet.</p>
              </Card>
            )}
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
                <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
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

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Invoices</h2>
              <p className="text-sm text-muted-foreground">
                View and track your project invoices
              </p>
            </div>

            <Card className="p-8 text-center">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No invoices yet.</p>
            </Card>
          </TabsContent>

          {/* Stages Tab */}
          <TabsContent value="stages" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Project Stages</h2>
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

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Documents</h2>
              <p className="text-sm text-muted-foreground">
                Project files and attachments
              </p>
            </div>

            {documents.length > 0 ? (
              <ClientDocumentsSection documents={documents} />
            ) : (
              <Card className="p-8 text-center">
                <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No documents uploaded yet.</p>
              </Card>
            )}
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

      {/* Quote View Modal */}
      {activeQuote && (
        <QuoteViewModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          quote={activeQuote}
          scopeItems={project.scopeItems}
          changeRequests={project.changeRequests}
          projectInfo={{
            name: project.name,
            clientName: project.clientName,
            clientEmail: project.clientEmail,
            tradeBusinessName: project.tradeBusinessName,
            tradeName: project.tradeName,
          }}
        />
      )}

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
