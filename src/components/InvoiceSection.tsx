import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import { exportInvoiceToXeroCSV, downloadCSV } from '@/lib/xeroExport';
import { downloadInvoicePDF } from '@/lib/invoicePdf';
import { InvoiceViewModal } from '@/components/InvoiceViewModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  projectName: string;
  clientName: string;
  clientEmail: string;
  tradeBusinessName?: string;
  tradeName?: string;
  onCreateInvoice: (data: {
    type: 'staged' | 'final';
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
  projectName,
  clientName,
  clientEmail,
  tradeBusinessName,
  tradeName,
  onCreateInvoice,
  onSendInvoice,
  onMarkAsPaid,
  onCancelInvoice,
  onDeleteInvoice,
  isTradeView = true,
}: InvoiceSectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [invoiceType, setInvoiceType] = useState<'staged' | 'final'>('staged');
  const [taxRate, setTaxRate] = useState(quote?.taxRate ?? 10);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [percentage, setPercentage] = useState(50);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [customDescription, setCustomDescription] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const includedItems = scopeItems.filter(item => item.category === 'included');
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');

  // Calculate totals
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const quoteTotal = quote?.total ?? 0;
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
    tradeBusinessName,
    tradeName,
  };

  const handleExportToXero = (invoice: Invoice) => {
    const csv = exportInvoiceToXeroCSV(invoice, { clientName, clientEmail });
    downloadCSV(csv, `${invoice.invoiceNumber}-xero.csv`);
    toast.success('Invoice exported for Xero');
  };

  const handleDownloadPDF = (invoice: Invoice) => {
    try {
      downloadInvoicePDF(invoice, projectInfo);
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
      lineItems = [{
        description: invoiceType === 'final' 
          ? 'Final Payment' 
          : `Progress Payment (${percentage}%)`,
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
      type: invoiceType,
      quoteId: quote?.id,
      taxRate,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes: notes || undefined,
      lineItems,
    });

    setIsSaving(false);
    setIsCreating(false);
    setSelectedItems({});
    setCustomDescription('');
    setCustomAmount('');
    setNotes('');
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
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{invoice.invoiceNumber}</h4>
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </Badge>
                        <Badge variant="outline">
                          {invoice.type === 'staged' ? 'Progress' : 'Final'}
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
              <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as 'staged' | 'final')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staged">Progress Payment</SelectItem>
                  <SelectItem value="final">Final Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Amount */}
            <div className="space-y-2">
              <Label>Amount ({percentage}% of quote)</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="range"
                  min="10"
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

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="invoiceNotes">Notes</Label>
              <Textarea
                id="invoiceNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment instructions, bank details, etc..."
                rows={3}
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
