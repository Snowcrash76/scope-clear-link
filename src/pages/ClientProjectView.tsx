import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/hooks/useProject';
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuoteLineItems } from '@/hooks/useQuoteLineItems';
import { toast } from 'sonner';
import { Package, RefreshCw, TrendingUp, FileText, Loader2, Calculator, Download, Eye, Receipt, FolderOpen } from 'lucide-react';
import { downloadQuotePDF } from '@/lib/quotePdf';
import { downloadInvoicePDF } from '@/lib/invoicePdf';
import { Invoice } from '@/types/project';
import { cn } from '@/lib/utils';

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
  const { lineItems: quoteLineItems } = useQuoteLineItems(activeQuote?.id);
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
  const approvedChanges = project.changeRequests.filter(cr => cr.status === 'approved');

  // Calculate live totals from current data
  const scopeSubtotal = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const changesImpact = approvedChanges.reduce((sum, cr) => sum + (cr.costImpact || 0), 0);
  const customItemsTotal = quoteLineItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const subtotal = scopeSubtotal + changesImpact + customItemsTotal;
  const taxRate = activeQuote?.taxRate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const liveTotal = subtotal + taxAmount;

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
              showTotal={true}
              totalAmount={liveTotal}
              approvedChanges={approvedChanges.map(cr => ({
                id: cr.id,
                title: cr.title,
                costImpact: cr.costImpact || 0
              }))}
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
              <Card className="p-6 space-y-6">
                {/* Header */}
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
                          project.changeRequests,
                          quoteLineItems
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

                {/* Line Items Breakdown */}
                <div className="space-y-4">
                  {/* Included Scope Items */}
                  {includedItems.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Included Items</h4>
                      <div className="border rounded-lg divide-y">
                        {includedItems.map(item => (
                          <div key={item.id} className="p-3 flex justify-between items-start">
                            <div className="flex-1 pr-4">
                              <p className="font-medium text-sm">{item.title}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                              )}
                            </div>
                            <span className="font-medium text-sm whitespace-nowrap">
                              ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approved Changes */}
                  {approvedChanges.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Approved Changes</h4>
                      <div className="border rounded-lg divide-y border-approved/30 bg-approved/5">
                        {approvedChanges.map(change => (
                          <div key={change.id} className="p-3 flex justify-between items-start">
                            <div className="flex-1 pr-4">
                              <p className="font-medium text-sm">{change.title}</p>
                              {change.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{change.description}</p>
                              )}
                            </div>
                            <span className={cn(
                              "font-medium text-sm whitespace-nowrap",
                              (change.costImpact || 0) > 0 ? "text-approved" : (change.costImpact || 0) < 0 ? "text-destructive" : ""
                            )}>
                              {(change.costImpact || 0) > 0 ? '+' : ''}${(change.costImpact || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Quote Line Items */}
                  {quoteLineItems.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Additional Items</h4>
                      <div className="border rounded-lg divide-y">
                        {quoteLineItems.map(item => (
                          <div key={item.id} className="p-3 flex justify-between items-start">
                            <div className="flex-1 pr-4">
                              <p className="font-medium text-sm">{item.title}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                              )}
                            </div>
                            <span className="font-medium text-sm whitespace-nowrap">
                              ${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ({taxRate}%)</span>
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
                                invoice.status === 'paid' ? 'default' :
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
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
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
          quoteLineItems={quoteLineItems}
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
