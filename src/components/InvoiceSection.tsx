import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Invoice, ScopeItem, ChangeRequest, Quote } from '@/types/project';
import { 
  FileText, 
  Send, 
  Plus,
  CheckCircle2,
  XCircle,
  DollarSign,
  Calendar,
  Trash2,
  Eye,
  Clock,
  CreditCard,
  Download,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { exportInvoiceToXeroCSV, downloadCSV } from '@/lib/xeroExport';
import { downloadInvoicePDF } from '@/lib/invoicePdf';
import { InvoiceViewModal } from '@/components/InvoiceViewModal';
import { toast } from 'sonner';
import { cn, isVariationItem } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface InvoiceSectionProps {
  invoices: Invoice[];
  quote: Quote | null;
  scopeItems: ScopeItem[];
  changeRequests: ChangeRequest[];
  quoteLineItems?: Array<{ id: string; cost: number | null }>;
  projectName: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  tradeBusinessName?: string;
  tradeName?: string;
  tradeAddress?: string;
  tradePhone?: string;
  tradeWebsite?: string;
  tradeAbn?: string;
  logoUrl?: string;
  defaultTerms?: string;
  defaultPaymentInstructions?: string;
  onCreateInvoice: (data: {
    type: 'staged' | 'final' | 'deposit';
    quoteId?: string;
    taxRate: number;
    dueDate?: Date;
    notes?: string;
    terms?: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      scopeItemId?: string;
      changeRequestId?: string;
    }>;
  }) => Promise<string | null>;
  onUpdateInvoiceNumber?: (invoiceId: string, num: string) => Promise<boolean>;
  onSendInvoice: (invoiceId: string) => Promise<boolean>;
  onMarkAsPaid: (invoiceId: string) => Promise<boolean>;
  onCancelInvoice: (invoiceId: string) => Promise<boolean>;
  onDeleteInvoice: (invoiceId: string) => Promise<boolean>;
  isTradeView?: boolean;
}

export function InvoiceSection({
  invoices,
  quote,
  scopeItems,
  changeRequests,
  quoteLineItems = [],
  projectName,
  clientName,
  clientEmail,
  clientAddress,
  tradeBusinessName,
  tradeName,
  tradeAddress,
  tradePhone,
  tradeWebsite,
  tradeAbn,
  logoUrl,
  defaultTerms,
  defaultPaymentInstructions,
  onUpdateInvoiceNumber,
  onCreateInvoice,
  onSendInvoice,
  onMarkAsPaid,
  onCancelInvoice,
  onDeleteInvoice,
  isTradeView = true,
}: InvoiceSectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Inline invoice reference editing
  const [editingInvRef, setEditingInvRef] = useState<string | null>(null);
  const [invRefValue, setInvRefValue] = useState('');
  const [isSavingInvRef, setIsSavingInvRef] = useState(false);

  const handleSaveInvRef = async () => {
    if (!editingInvRef || !invRefValue.trim() || !onUpdateInvoiceNumber) return;
    setIsSavingInvRef(true);
    const success = await onUpdateInvoiceNumber(editingInvRef, invRefValue.trim());
    setIsSavingInvRef(false);
    if (success) setEditingInvRef(null);
  };

  const [invoiceType, setInvoiceType] = useState<'staged' | 'final' | 'deposit' | 'custom'>('staged');
  const [customTypeLabel, setCustomTypeLabel] = useState('');
  const [taxRate, setTaxRate] = useState(quote?.taxRate ?? 10);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState(defaultPaymentInstructions || '');
  const [terms, setTerms] = useState(defaultTerms || '');

  // Re-sync when profile defaults load asynchronously after component mount
  useEffect(() => {
    if (defaultPaymentInstructions) setNotes(defaultPaymentInstructions);
  }, [defaultPaymentInstructions]);
  useEffect(() => {
    if (defaultTerms) setTerms(defaultTerms);
  }, [defaultTerms]);

  const [percentage, setPercentage] = useState(50);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [customDescription, setCustomDescription] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const includedItems = scopeItems.filter(item => item.category === 'included' && !isVariationItem(item.title));
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');

  // Calculate live quote total — variation duplicates filtered; costs come from approvedChanges only
  const baseQuoteLineItems = quoteLineItems.filter(item => !isVariationItem(item.title));
  const liveScopeSubtotal = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const liveChangesImpact = approvedChanges.reduce((sum, cr) => sum + cr.costImpact, 0);
  const liveCustomItemsTotal = baseQuoteLineItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const liveSubtotal = liveScopeSubtotal + liveChangesImpact + liveCustomItemsTotal;
  const liveTaxAmount = liveSubtotal * ((quote?.taxRate ?? taxRate) / 100);
  const quoteTotal = quote ? liveSubtotal + liveTaxAmount : 0;

  // Calculate totals
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const remainingAmount = quoteTotal - totalInvoiced;

  const statusConfig = {
    draft: { label: 'Draft', variant: 'secondary' as const, icon: FileText },
    sent: { label: 'Sent', variant: 'pending' as const, icon: Send },
    paid: { label: 'Paid', variant: 'success' as const, icon: CheckCircle2 },
    overdue: { label: 'Overdue', variant: 'destructive' as const, icon: Clock },
    cancelled: { label: 'Cancelled', variant: 'outline' as const, icon: XCircle },
  };

  const projectInfo = {
    name: projectName,
    clientName,
    clientEmail,
    clientAddress,
    tradeBusinessName,
    tradeName,
    tradeAddress,
    tradePhone,
    tradeWebsite,
    abn: tradeAbn,
    logoUrl,
    paymentInstructions: defaultPaymentInstructions,
    defaultTermsText: defaultTerms,
  };

  const handleExportToXero = (invoice: Invoice) => {
    const csv = exportInvoiceToXeroCSV(invoice, { clientName, clientEmail });
    downloadCSV(csv, `${invoice.invoiceNumber}-xero.csv`);
    toast.success('Invoice exported for Xero');
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      await downloadInvoicePDF(invoice, projectInfo);
      toast.success('Invoice PDF downloaded');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  const handleCreateInvoice = async () => {
    setIsSaving(true);

    let lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      scopeItemId?: string;
      changeRequestId?: string;
    }> = [];

    if (invoiceType === 'final' || Object.keys(selectedItems).length === 0) {
      // For final invoice or if no items selected, use percentage of quote
      const amount = quoteTotal * (percentage / 100);
      const description = invoiceType === 'final'
        ? 'Final Payment'
        : invoiceType === 'deposit'
        ? `Deposit (${percentage}%)`
        : invoiceType === 'custom'
        ? (customTypeLabel.trim() || 'Custom Invoice')
        : `Progress Payment (${percentage}%)`;
      lineItems = [{
        description,
        quantity: 1,
        unitPrice: amount / (1 + taxRate / 100), // Remove tax for subtotal
      }];
    } else if (customDescription && customAmount) {
      // Custom line item
      lineItems = [{
        description: customDescription,
        quantity: 1,
        unitPrice: parseFloat(customAmount),
      }];
    } else {
      // Selected scope items
      lineItems = Object.entries(selectedItems)
        .filter(([_, selected]) => selected)
        .map(([id]) => {
          const scopeItem = includedItems.find(i => i.id === id);
          const change = approvedChanges.find(c => c.id === id);
          
          if (scopeItem) {
            return {
              description: scopeItem.title,
              quantity: 1,
              unitPrice: scopeItem.cost || 0,
              scopeItemId: id,
            };
          } else if (change) {
            return {
              description: change.title,
              quantity: 1,
              unitPrice: change.costImpact,
              changeRequestId: id,
            };
          }
          return null;
        })
        .filter(Boolean) as typeof lineItems;
    }

    await onCreateInvoice({
      type: invoiceType === 'custom' ? 'staged' : invoiceType,
      quoteId: quote?.id,
      taxRate,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes: notes || undefined,
      terms: terms || undefined,
      lineItems,
    });

    setIsSaving(false);
    setIsCreating(false);
    setSelectedItems({});
    setCustomDescription('');
    setCustomAmount('');
    setCustomTypeLabel('');
    setNotes('');
    setTerms(defaultTerms || '');
    setDueDate('');
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Invoiced</p>
              <p className="text-lg font-bold">
                ${totalInvoiced.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-approved/10">
              <CheckCircle2 className="w-5 h-5 text-approved" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-lg font-bold text-approved">
                ${totalPaid.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pending/10">
              <Clock className="w-5 h-5 text-pending-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-lg font-bold">
                ${remainingAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Create Invoice Button */}
      {isTradeView && quote?.status === 'approved' && (
        <div className="flex justify-end">
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      )}

      {/* Invoice List */}
      {invoices.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-heading text-lg font-semibold mb-2">No Invoices Yet</h3>
          <p className="text-muted-foreground mb-6">
            {quote?.status === 'approved' 
              ? 'Create invoices for progress payments or final billing.'
              : 'Invoices can be created after the quote is approved.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {invoices.map(invoice => {
            const config = statusConfig[invoice.status];
            const StatusIcon = config.icon;
            
            return (
              <Card key={invoice.id} className="p-4">
                {/* Prominent heading from first line item */}
                {invoice.lineItems.length > 0 && (
                  <div className="mb-4 pb-3 border-b">
                    <h3 className="text-lg font-semibold text-primary border-l-4 border-primary pl-3">
                      {invoice.lineItems[0].description}
                    </h3>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isTradeView && editingInvRef === invoice.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={invRefValue}
                              onChange={e => setInvRefValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveInvRef();
                                if (e.key === 'Escape') setEditingInvRef(null);
                              }}
                              className="h-7 text-sm font-medium w-36"
                              autoFocus
                              data-testid={`input-invoice-reference-${invoice.id}`}
                            />
                            <button
                              onClick={handleSaveInvRef}
                              disabled={isSavingInvRef || !invRefValue.trim()}
                              className="p-1 rounded hover:bg-muted transition-colors text-primary"
                              data-testid={`button-save-invoice-reference-${invoice.id}`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingInvRef(null)}
                              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                              data-testid={`button-cancel-invoice-reference-${invoice.id}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group/invref">
                            <h4 className="font-medium">{invoice.invoiceNumber}</h4>
                            {isTradeView && onUpdateInvoiceNumber && (
                              <button
                                onClick={() => { setEditingInvRef(invoice.id); setInvRefValue(invoice.invoiceNumber); }}
                                className="p-1 rounded opacity-0 group-hover/invref:opacity-100 hover:bg-muted transition-all text-muted-foreground"
                                title="Edit reference"
                                data-testid={`button-edit-invoice-reference-${invoice.id}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
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
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        ${invoice.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">inc. GST</p>
                      {invoice.amountPaid > 0 && invoice.amountPaid < invoice.total && (
                        <p className="text-sm text-muted-foreground">
                          Paid: ${invoice.amountPaid.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {/* View and Download buttons for all views */}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setViewingInvoice(invoice)}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDownloadPDF(invoice)}
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      
                      {/* Trade-only actions */}
                      {isTradeView && (
                        <>
                          {invoice.status === 'draft' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => onSendInvoice(invoice.id)}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => onDeleteInvoice(invoice.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {invoice.status === 'sent' && (
                            <Button 
                              size="sm"
                              onClick={() => onMarkAsPaid(invoice.id)}
                            >
                              <CreditCard className="w-4 h-4 mr-1" />
                              Mark Paid
                            </Button>
                          )}
                          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => onCancelInvoice(invoice.id)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {invoice.status === 'cancelled' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => onDeleteInvoice(invoice.id)}
                              title="Delete invoice"
                              data-testid={`button-delete-invoice-${invoice.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          {(invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue') && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleExportToXero(invoice)}
                              title="Export to Xero CSV"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

              </Card>
            );
          })}
        </div>
      )}

      {/* Create Invoice Modal */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Invoice Type */}
            <div className="space-y-2">
              <Label>Invoice Type</Label>
              <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as 'staged' | 'final' | 'deposit' | 'custom')}>
                <SelectTrigger data-testid="select-invoice-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="staged">Progress Payment</SelectItem>
                  <SelectItem value="final">Final Invoice</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              {invoiceType === 'custom' && (
                <Input
                  value={customTypeLabel}
                  onChange={e => setCustomTypeLabel(e.target.value)}
                  placeholder="e.g. Retention, Variation Invoice, Mobilisation..."
                  data-testid="input-custom-invoice-type"
                />
              )}
            </div>

            {/* Payment Amount */}
            <div className="space-y-2">
              <Label>Amount ({percentage}% of quote)</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={percentage}
                  onChange={(e) => setPercentage(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="font-medium w-24 text-right">
                  ${((quoteTotal * percentage / 100)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Tax Rate */}
            <div className="space-y-2">
              <Label htmlFor="invoiceTaxRate">Tax Rate (%)</Label>
              <Input
                id="invoiceTaxRate"
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="invoiceDueDate">Due Date</Label>
              <Input
                id="invoiceDueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Payment Instructions */}
            <div className="space-y-2">
              <Label htmlFor="invoiceNotes">Payment Instructions</Label>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Bank: ANZ, BSB: 123-456, Account: 12345678..."
              />
              <p className="text-xs text-muted-foreground">
                Include bank details and payment reference for your client.
              </p>
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-2">
              <Label htmlFor="invoiceTerms">Terms & Conditions</Label>
              <RichTextEditor
                value={terms}
                onChange={setTerms}
                placeholder="Payment terms, warranty information..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice View Modal */}
      <InvoiceViewModal
        isOpen={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        invoice={viewingInvoice}
        project={projectInfo}
      />
    </div>
  );
}
