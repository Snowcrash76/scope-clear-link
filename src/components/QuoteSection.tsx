import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Quote, ScopeItem, ChangeRequest } from '@/types/project';
import { 
  FileText, 
  Send, 
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  DollarSign,
  Calendar,
  Edit,
  Eye,
  Download,
} from 'lucide-react';
import { exportQuoteToXeroCSV, downloadCSV } from '@/lib/xeroExport';
import { downloadQuotePDF } from '@/lib/quotePdf';
import { QuoteViewModal } from '@/components/QuoteViewModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface QuoteSectionProps {
  quote: Quote | null;
  scopeItems: ScopeItem[];
  changeRequests: ChangeRequest[];
  clientName?: string;
  clientEmail?: string;
  projectName?: string;
  tradeBusinessName?: string;
  tradeName?: string;
  onCreateQuote: (data: {
    subtotal: number;
    taxRate: number;
    notes?: string;
    terms?: string;
    validUntil?: Date;
  }) => Promise<string | null>;
  onUpdateQuote: (quoteId: string, data: Partial<{
    subtotal: number;
    taxRate: number;
    notes: string;
    terms: string;
    validUntil: Date;
  }>) => Promise<boolean>;
  onSendQuote: (quoteId: string) => Promise<boolean>;
  onReviseQuote: (quoteId: string) => Promise<boolean>;
  isTradeView?: boolean;
}

export function QuoteSection({
  quote,
  scopeItems,
  changeRequests,
  clientName = '',
  clientEmail = '',
  projectName = '',
  tradeBusinessName = '',
  tradeName = '',
  onCreateQuote,
  onUpdateQuote,
  onSendQuote,
  onReviseQuote,
  isTradeView = true,
}: QuoteSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(quote?.taxRate ?? 10);
  const [notes, setNotes] = useState(quote?.notes ?? '');
  const [terms, setTerms] = useState(quote?.terms ?? '');
  const [validUntil, setValidUntil] = useState<string>(
    quote?.validUntil ? format(quote.validUntil, 'yyyy-MM-dd') : ''
  );
  const [isSaving, setIsSaving] = useState(false);

  // Calculate totals from scope items
  const includedItems = scopeItems.filter(item => item.category === 'included');
  const scopeSubtotal = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  
  // Add approved change request impacts
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');
  const changesImpact = approvedChanges.reduce((sum, cr) => sum + cr.costImpact, 0);
  
  const subtotal = scopeSubtotal + changesImpact;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleCreateQuote = async () => {
    setIsSaving(true);
    await onCreateQuote({
      subtotal,
      taxRate,
      notes: notes || undefined,
      terms: terms || undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
    });
    setIsSaving(false);
    setIsCreating(false);
  };

  const handleUpdateQuote = async () => {
    if (!quote) return;
    setIsSaving(true);
    const success = await onUpdateQuote(quote.id, {
      subtotal,
      taxRate,
      notes,
      terms,
      validUntil: validUntil ? new Date(validUntil) : undefined,
    });
    setIsSaving(false);
    if (success) setIsEditing(false);
  };

  const handleSendQuote = async () => {
    if (!quote) return;
    await onSendQuote(quote.id);
  };

  const handleReviseQuote = async () => {
    if (!quote) return;
    await onReviseQuote(quote.id);
    setIsCreating(true);
  };

  const handleExportToXero = () => {
    if (!quote) return;
    const csv = exportQuoteToXeroCSV(quote, { clientName, clientEmail }, scopeItems, changeRequests);
    downloadCSV(csv, `${quote.quoteNumber}-xero.csv`);
    toast.success('Quote exported for Xero');
  };

  const handleDownloadPDF = () => {
    if (!quote) return;
    downloadQuotePDF(
      quote,
      { name: projectName, clientName, clientEmail, tradeBusinessName, tradeName },
      scopeItems,
      changeRequests
    );
    toast.success('Quote PDF downloaded');
  };

  const projectInfo = {
    name: projectName,
    clientName,
    clientEmail,
    tradeBusinessName,
    tradeName,
  };

  const statusConfig = {
    draft: { label: 'Draft', variant: 'secondary' as const, icon: Edit },
    sent: { label: 'Sent', variant: 'pending' as const, icon: Send },
    approved: { label: 'Approved', variant: 'success' as const, icon: CheckCircle2 },
    declined: { label: 'Declined', variant: 'destructive' as const, icon: XCircle },
    revised: { label: 'Revised', variant: 'outline' as const, icon: RefreshCw },
  };

  // No quote exists yet
  if (!quote && !isCreating) {
    return (
      <Card className="p-8 text-center">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-heading text-lg font-semibold mb-2">No Quote Created</h3>
        <p className="text-muted-foreground mb-6">
          Create a quote based on your scope items to send to the client for approval.
        </p>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Quote
        </Button>
      </Card>
    );
  }

  // Creating new quote or editing
  if (isCreating || isEditing) {
    return (
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold">
            {isCreating ? 'Create Quote' : 'Edit Quote'}
          </h3>
        </div>

        {/* Line Items Preview */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Line Items (from Scope)
          </h4>
          <div className="border rounded-lg divide-y">
            {includedItems.map(item => (
              <div key={item.id} className="p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <span className="text-sm font-medium">{item.title}</span>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    )}
                  </div>
                  <span className="font-medium whitespace-nowrap">
                    ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
            {approvedChanges.length > 0 && (
              <>
                <div className="p-3 bg-muted/50">
                  <span className="text-sm font-medium text-muted-foreground">
                    Approved Changes
                  </span>
                </div>
                {approvedChanges.map(change => (
                  <div key={change.id} className="p-3 bg-muted/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <span className="text-sm font-medium">{change.title}</span>
                        {change.description && (
                          <p className="text-xs text-muted-foreground mt-1">{change.description}</p>
                        )}
                      </div>
                      <span className={cn(
                        "font-medium whitespace-nowrap",
                        change.costImpact > 0 ? "text-approved" : change.costImpact < 0 ? "text-destructive" : ""
                      )}>
                        {change.costImpact > 0 ? '+' : ''}${change.costImpact.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">
              ${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <Label htmlFor="taxRate" className="text-muted-foreground whitespace-nowrap">Tax Rate (%)</Label>
            <Input
              id="taxRate"
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-24"
            />
            <span className="ml-auto font-medium">
              ${taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between text-lg font-bold border-t pt-3">
            <span>Total</span>
            <span className="text-primary">
              ${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Additional Fields */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="validUntil">Valid Until</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the client..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="terms">Terms & Conditions</Label>
            <Textarea
              id="terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Payment terms, warranty, etc..."
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button 
            variant="outline" 
            onClick={() => {
              setIsCreating(false);
              setIsEditing(false);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={isCreating ? handleCreateQuote : handleUpdateQuote}
            disabled={isSaving || subtotal <= 0}
          >
            {isSaving ? 'Saving...' : isCreating ? 'Create Quote' : 'Save Changes'}
          </Button>
        </div>
      </Card>
    );
  }

  // Display existing quote
  const config = statusConfig[quote!.status];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6">
      {/* Quote Header */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-heading font-semibold">{quote!.quoteNumber}</h3>
              <p className="text-sm text-muted-foreground">
                Created {format(quote!.createdAt, 'dd MMM yyyy')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={config.variant} className="gap-1.5">
              <StatusIcon className="w-3.5 h-3.5" />
              {config.label}
            </Badge>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-3 mb-6">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Line Items
          </h4>
          <div className="border rounded-lg divide-y">
            {includedItems.map(item => (
              <div key={item.id} className="p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <span className="text-sm font-medium">{item.title}</span>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    )}
                  </div>
                  <span className="font-medium whitespace-nowrap">
                    ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
            {approvedChanges.length > 0 && (
              <>
                <div className="p-3 bg-muted/50">
                  <span className="text-sm font-medium text-muted-foreground">
                    Approved Changes
                  </span>
                </div>
                {approvedChanges.map(change => (
                  <div key={change.id} className="p-3 bg-muted/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <span className="text-sm font-medium">{change.title}</span>
                        {change.description && (
                          <p className="text-xs text-muted-foreground mt-1">{change.description}</p>
                        )}
                      </div>
                      <span className={cn(
                        "font-medium whitespace-nowrap",
                        change.costImpact > 0 ? "text-approved" : change.costImpact < 0 ? "text-destructive" : ""
                      )}>
                        {change.costImpact > 0 ? '+' : ''}${change.costImpact.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${quote!.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({quote!.taxRate}%)</span>
            <span>${quote!.taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
            <span>Total</span>
            <span className="text-primary">
              ${quote!.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Additional Info */}
        {(quote!.validUntil || quote!.notes || quote!.terms) && (
          <div className="mt-6 space-y-4 border-t pt-4">
            {quote!.validUntil && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Valid until:</span>
                <span>{format(quote!.validUntil, 'dd MMM yyyy')}</span>
              </div>
            )}
            {quote!.notes && (
              <div>
                <h4 className="text-sm font-medium mb-1">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote!.notes}</p>
              </div>
            )}
            {quote!.terms && (
              <div>
                <h4 className="text-sm font-medium mb-1">Terms & Conditions</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote!.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Client Comment (if any) */}
        {quote!.clientComment && (
          <div className="mt-6 p-4 rounded-lg bg-secondary/50">
            <h4 className="text-sm font-medium mb-1">Client Comment</h4>
            <p className="text-sm text-muted-foreground">{quote!.clientComment}</p>
          </div>
        )}

        {/* Actions (Trade View) */}
        {isTradeView && (
          <div className="mt-6 flex flex-wrap gap-3">
            {/* View and Download buttons - always available */}
            <Button variant="outline" onClick={() => setIsViewModalOpen(true)}>
              <Eye className="w-4 h-4 mr-2" />
              View Quote
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            
            {quote!.status === 'draft' && (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Quote
                </Button>
                <Button onClick={handleSendQuote}>
                  <Send className="w-4 h-4 mr-2" />
                  Send to Client
                </Button>
              </>
            )}
            {quote!.status === 'sent' && (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Quote
                </Button>
                <Button variant="outline" onClick={handleExportToXero}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export to Xero
                </Button>
              </>
            )}
            {quote!.status === 'approved' && (
              <Button variant="outline" onClick={handleExportToXero}>
                <FileText className="w-4 h-4 mr-2" />
                Export to Xero
              </Button>
            )}
            {(quote!.status === 'declined' || quote!.status === 'revised') && (
              <Button onClick={handleReviseQuote}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Create Revised Quote
              </Button>
            )}
          </div>
        )}

        {/* Client View - View and Download buttons */}
        {!isTradeView && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setIsViewModalOpen(true)}>
              <Eye className="w-4 h-4 mr-2" />
              View Quote
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        )}
      </Card>

      {/* Quote View Modal */}
      {quote && (
        <QuoteViewModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          quote={quote}
          scopeItems={scopeItems}
          changeRequests={changeRequests}
          projectInfo={projectInfo}
        />
      )}
    </div>
  );
}
