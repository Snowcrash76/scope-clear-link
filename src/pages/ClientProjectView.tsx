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
import { InvoiceViewModal } from '@/components/InvoiceViewModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProject } from '@/hooks/useProject';
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import { toast } from 'sonner';
import { Package, RefreshCw, TrendingUp, FileText, Loader2, Calculator, Download, Eye, Receipt, FolderOpen } from 'lucide-react';
import { downloadQuotePDF } from '@/lib/quotePdf';
import { downloadInvoicePDF } from '@/lib/invoicePdf';
import { Invoice } from '@/types/project';

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
  
  const { activeQuote, approveQuote, declineQuote, refetch: refetchQuotes } = useQuotes(id);
  const { invoices, loading: invoicesLoading } = useInvoices(id);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Move useState to top before any conditional returns (React hooks rule)
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

  const pendingChanges = project.changeRequests.filter(cr => cr.status === 'pending' || cr.status === 'awaiting_client');
  const resolvedChanges = project.changeRequests.filter(cr => cr.status === 'approved' || cr.status === 'declined');

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

  const handleQuoteApproval = async (comment: string) => {
    const { action } = quoteApprovalModal;
    if (!activeQuote) return;
    
    try {
      if (action === 'approve') {
        await approveQuote(activeQuote.id, comment);
        toast.success('Quote approved! Your trade has been notified.');
      } else {
        await declineQuote(activeQuote.id, comment);
        toast.success('Quote declined. Your trade has been notified.');
      }
      await refetchQuotes();
    } catch (error) {
      console.error('Quote approval error:', error);
      toast.error(`Failed to ${action} quote`);
    }
    setQuoteApprovalModal({ isOpen: false, action: 'approve' });
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
          <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch] touch-pan-x overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max sm:w-auto inline-flex flex-nowrap justify-start">
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
          </div>

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
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{activeQuote.quoteNumber}</h3>
                      {activeQuote.status === 'sent' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          Awaiting Response
                        </span>
                      )}
                      {activeQuote.status === 'approved' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          Approved
                        </span>
                      )}
                      {activeQuote.status === 'declined' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          Declined
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Total: ${activeQuote.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </p>
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
                    <Button variant="outline" onClick={() => {
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

                {/* Approve/Decline Buttons for sent quotes */}
                {activeQuote.status === 'sent' && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setQuoteApprovalModal({ isOpen: true, action: 'decline' })}
                    >
                      Decline Quote
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => setQuoteApprovalModal({ isOpen: true, action: 'approve' })}
                    >
                      Approve Quote
                    </Button>
                  </div>
                )}

                {/* Show client comment if exists */}
                {activeQuote.clientComment && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Your comment:</p>
                    <p className="text-sm mt-1">{activeQuote.clientComment}</p>
                  </div>
                )}
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

            {invoicesLoading ? (
              <Card className="p-8 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </Card>
            ) : invoices.filter(inv => inv.status !== 'draft').length > 0 ? (
              <div className="space-y-4">
                {invoices.filter(inv => inv.status !== 'draft').map(invoice => (
                  <Card key={invoice.id} className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                          {invoice.status === 'sent' && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              Sent
                            </span>
                          )}
                          {invoice.status === 'paid' && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              Paid
                            </span>
                          )}
                          {invoice.status === 'overdue' && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              Overdue
                            </span>
                          )}
                          {invoice.status === 'cancelled' && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
                              Cancelled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Total: ${invoice.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </p>
                        {invoice.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(invoice.dueDate).toLocaleDateString()}
                          </p>
                        )}
                        {invoice.paidAt && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Paid on {new Date(invoice.paidAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold">
                          ${invoice.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="flex gap-2">
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
                                downloadInvoicePDF(invoice, {
                                  name: project.name,
                                  clientName: project.clientName,
                                  clientEmail: project.clientEmail,
                                  tradeBusinessName: project.tradeBusinessName,
                                  tradeName: project.tradeName,
                                });
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
                      </div>
                    </div>
                  </Card>
                ))}
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
              project={{
                name: project.name,
                clientName: project.clientName,
                clientEmail: project.clientEmail,
                tradeBusinessName: project.tradeBusinessName,
                tradeName: project.tradeName,
              }}
            />
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

      {/* Change Request Approval Modal */}
      <ApprovalModal
        isOpen={approvalModal.isOpen}
        onClose={() => setApprovalModal({ isOpen: false, action: 'approve', changeId: '', title: '' })}
        onConfirm={handleConfirmApproval}
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
