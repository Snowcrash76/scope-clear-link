import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ExclusionsPanel } from '@/components/ExclusionsPanel';
import { ProjectTimeline } from '@/components/ProjectTimeline';
import { QuoteViewModal } from '@/components/QuoteViewModal';
import { InvoiceViewModal } from '@/components/InvoiceViewModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Invoice } from '@/types/project';
import { RefreshCw, TrendingUp, FileText, Eye, Download, Receipt, FolderOpen, ArrowRight, CheckCircle2, DollarSign, Clock, MessageSquarePlus, Info } from 'lucide-react';
import { cn, stripVariationMeta } from '@/lib/utils';
import { RichTextContent } from '@/components/RichTextEditor';
import { DEMO_PROJECT, DEMO_QUOTE, DEMO_QUOTE_LINE_ITEMS, DEMO_INVOICES } from '@/data/demoProject';

export default function DemoProjectView() {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const project = DEMO_PROJECT;
  const activeQuote = DEMO_QUOTE;
  const invoices = DEMO_INVOICES;
  const quoteLineItems = DEMO_QUOTE_LINE_ITEMS;

  const approvedChanges = project.changeRequests.filter(cr => cr.status === 'approved');
  const approvedChangeCosts = new Set(approvedChanges.map(cr => cr.costImpact));
  const pendingChanges = project.changeRequests.filter(cr => cr.status === 'pending' || cr.status === 'awaiting_client');

  const includedItems = project.scopeItems.filter(
    item => item.category === 'included' && !approvedChangeCosts.has(item.cost ?? -1)
  );
  const variationScopeItems = approvedChanges.map(cr => ({
    id: cr.id,
    title: cr.title,
    description: cr.description || '',
    category: 'included' as const,
    acknowledged: true,
    cost: cr.costImpact,
  }));
  const excludedItems = project.scopeItems.filter(item => item.category === 'excluded');
  const assumptionItems = project.scopeItems.filter(item => item.category === 'assumption');

  const scopeSubtotal = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const changesImpact = approvedChanges.reduce((sum, cr) => sum + cr.costImpact, 0);
  const subtotal = scopeSubtotal + changesImpact;
  const taxRate = activeQuote.taxRate;
  const taxAmount = subtotal * (taxRate / 100);
  const liveTotal = subtotal + taxAmount;

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

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner */}
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm font-medium">
            You're viewing a live demo — this is what your clients see when you use ScopeClear.
          </p>
          <Link
            to="/signup"
            className="flex items-center gap-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 transition-colors px-3 py-1 rounded-full whitespace-nowrap"
          >
            Get started free
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <ProjectHeader project={project} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Tabs */}
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
              <TabsTrigger value="changes" className="gap-2">
                <RefreshCw className="w-4 h-4 hidden sm:block" />
                Variations
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

          {/* Quote Tab */}
          <TabsContent value="quote" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Quote Details</h2>
              <p className="text-sm text-muted-foreground">Review and download your quote</p>
            </div>

            <Card className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{activeQuote.quoteNumber}</h3>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-approved/15 text-approved font-medium">
                      Approved
                    </span>
                  </div>
                  {activeQuote.approvedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Approved on {format(activeQuote.approvedAt, 'd MMM yyyy')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setIsQuoteModalOpen(true)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  <Button variant="outline" disabled title="Not available in demo">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Included Items */}
              {includedItems.length > 0 && (
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
                </div>
              )}

              {/* Approved Variations */}
              {approvedChanges.length > 0 && (
                <div className="border border-approved/30 rounded-lg divide-y bg-approved/5">
                  <div className="px-3 py-2 border-b border-approved/20">
                    <span className="text-xs font-semibold text-approved uppercase tracking-wide">Approved Variations</span>
                  </div>
                  {approvedChanges.map(change => (
                    <div key={change.id} className="p-3 flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-medium">{change.title}</p>
                        {change.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{change.description}</p>
                        )}
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap text-approved">
                        +${change.costImpact.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
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
                  <span>GST ({taxRate}%)</span>
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
            </Card>

            {/* Exclusions & Assumptions — read-only collapsible panel */}
            {(excludedItems.length > 0 || assumptionItems.length > 0) && (
              <ExclusionsPanel
                excludedItems={excludedItems}
                assumptionItems={assumptionItems}
              />
            )}
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Invoices</h2>
              <p className="text-sm text-muted-foreground">View and track your job invoices</p>
            </div>

            <div className="space-y-4">
              {invoices.map(invoice => {
                const firstLineItem = invoice.lineItems?.[0];
                return (
                  <Card key={invoice.id} className="p-4 sm:p-6">
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
                              {invoice.type === 'deposit' ? 'Deposit' : invoice.type === 'staged' ? 'Progress' : 'Final'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Created {format(invoice.createdAt, 'dd MMM yyyy')}
                            {invoice.dueDate && (
                              <> • Due {format(invoice.dueDate, 'dd MMM yyyy')}</>
                            )}
                          </p>
                          {invoice.paidAt && (
                            <p className="text-xs text-approved mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Paid on {format(invoice.paidAt, 'dd MMM yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold">
                          ${invoice.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">inc. GST</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 pt-3 border-t">
                      <Button variant="outline" size="sm" onClick={() => setViewingInvoice(invoice)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" disabled title="Not available in demo">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Variations Tab */}
          <TabsContent value="changes" className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold">Variations</h2>
                <p className="text-sm text-muted-foreground">
                  Track all modifications to the original quote
                </p>
              </div>
              <Button variant="outline" disabled>
                Request a Change
              </Button>
            </div>

            {/* Demo notice */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/60 border text-sm text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>In a live job, clients can approve or decline variations and submit new requests directly from this page.</span>
            </div>

            {(() => {
              const approved = project.changeRequests.filter(cr => cr.status === 'approved');
              const awaiting = project.changeRequests.filter(cr => cr.status === 'pending' || cr.status === 'awaiting_client');

              const renderReadOnlyCard = (request: typeof project.changeRequests[0]) => {
                const isApproved = request.status === 'approved';
                const isPending = request.status === 'pending' || request.status === 'awaiting_client';
                return (
                  <Card key={request.id} className={cn(
                    "overflow-hidden",
                    isPending && "ring-2 ring-pending/50",
                    isApproved && "border-approved/40 bg-approved/5"
                  )}>
                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-secondary">
                            {request.type === 'client_request'
                              ? <MessageSquarePlus className="w-4 h-4 text-primary" />
                              : <RefreshCw className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <div>
                            <Badge variant="secondary" className="text-xs mb-1">
                              {request.type === 'client_request' ? 'Client Request' : 'Substitution'}
                            </Badge>
                            <h3 className="font-heading font-semibold">{request.title}</h3>
                          </div>
                        </div>
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          isApproved ? "bg-approved/15 text-approved" : "bg-pending/15 text-pending-foreground"
                        )}>
                          {isApproved ? 'Approved' : 'Awaiting Response'}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground leading-relaxed">{request.description}</p>

                      <div className="flex flex-wrap gap-3">
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
                          request.costImpact > 0 ? "bg-warning/10 text-warning-foreground" : "bg-secondary text-muted-foreground"
                        )}>
                          <DollarSign className="w-4 h-4" />
                          <span className="font-medium">
                            {request.costImpact === 0 ? 'Cost TBC' : `+$${request.costImpact.toLocaleString()}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-secondary text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">
                            {request.timeImpact === 0 ? 'No delay' : `+${request.timeImpact} day${request.timeImpact > 1 ? 's' : ''}`}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Submitted {format(request.createdAt, 'MMM d, yyyy')}
                        {request.resolvedAt ? ` • Resolved ${format(request.resolvedAt, 'MMM d, yyyy')}` : ''}
                      </p>

                      {isApproved && (
                        <div className="pt-2 border-t flex items-center gap-2 text-sm text-approved">
                          <CheckCircle2 className="w-4 h-4" />
                          Approved and added to the job scope
                        </div>
                      )}
                      {isPending && request.type === 'client_request' && (
                        <div className="pt-2 border-t text-sm text-muted-foreground">
                          Your trade is reviewing this request
                        </div>
                      )}
                    </div>
                  </Card>
                );
              };

              return (
                <div className="space-y-8">
                  {awaiting.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-semibold text-base">Awaiting Response</h3>
                        <span className="text-xs font-medium bg-pending/15 text-pending-foreground px-2 py-0.5 rounded-full">
                          {awaiting.length}
                        </span>
                      </div>
                      {awaiting.map(renderReadOnlyCard)}
                    </div>
                  )}
                  {approved.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-semibold text-base">Approved</h3>
                        <span className="text-xs font-medium bg-approved/15 text-approved px-2 py-0.5 rounded-full">
                          {approved.length}
                        </span>
                      </div>
                      {approved.map(renderReadOnlyCard)}
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* Stages Tab */}
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

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Documents</h2>
              <p className="text-sm text-muted-foreground">Shared files and job documents</p>
            </div>
            <Card className="p-8 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No documents shared yet.</p>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sign-up CTA */}
        <Card className="p-6 bg-primary/5 border-primary/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-heading font-bold text-lg">Ready to set this up for your business?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Give your clients a professional project portal — quotes, invoices, variations, and stages all in one place.
              </p>
            </div>
            <Link to="/signup">
              <Button className="whitespace-nowrap">
                Get started free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      </main>

      {/* Quote Modal */}
      <QuoteViewModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        quote={activeQuote}
        scopeItems={project.scopeItems}
        changeRequests={project.changeRequests}
        quoteLineItems={quoteLineItems}
        isDemo
        projectInfo={tradeProjectInfo}
      />

      {/* Invoice Modal */}
      <InvoiceViewModal
        isOpen={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        invoice={viewingInvoice}
        project={tradeProjectInfo}
      />
    </div>
  );
}
