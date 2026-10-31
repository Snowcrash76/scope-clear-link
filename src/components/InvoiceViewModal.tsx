import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Invoice } from '@/types/project';
import { RichTextContent } from '@/components/RichTextEditor';
import { format } from 'date-fns';
import { Download, FileText, CheckCircle2, Clock, XCircle, Send } from 'lucide-react';
import { downloadInvoicePDF } from '@/lib/invoicePdf';
import { toast } from 'sonner';

interface ProjectInfo {
  name: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  tradeBusinessName?: string;
  tradeName?: string;
  tradeAddress?: string;
  tradePhone?: string;
  tradeWebsite?: string;
  abn?: string;
  logoUrl?: string;
}

interface InvoiceViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  project: ProjectInfo;
}

export function InvoiceViewModal({ isOpen, onClose, invoice, project }: InvoiceViewModalProps) {
  if (!invoice) return null;

  const statusConfig = {
    draft: { label: 'Draft', variant: 'secondary' as const, icon: FileText },
    sent: { label: 'Sent', variant: 'pending' as const, icon: Send },
    paid: { label: 'Paid', variant: 'success' as const, icon: CheckCircle2 },
    overdue: { label: 'Overdue', variant: 'destructive' as const, icon: Clock },
    cancelled: { label: 'Cancelled', variant: 'outline' as const, icon: XCircle },
  };

  const config = statusConfig[invoice.status];
  const StatusIcon = config.icon;

  const handleDownload = async () => {
    try {
      await downloadInvoicePDF(invoice, project);
      toast.success('Invoice PDF downloaded');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden p-4 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:p-6">
        <DialogHeader className="shrink-0">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 pr-8">
            <DialogTitle className="max-h-[25dvh] min-w-0 overflow-y-auto break-all text-xl font-bold">
              Invoice {invoice.invoiceNumber}
            </DialogTitle>
            <Button className="shrink-0" variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain py-4">
          {/* Status and Type */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={config.variant} className="gap-1">
              <StatusIcon className="w-3 h-3" />
              {config.label}
            </Badge>
            <Badge variant="outline">
              {invoice.type === 'deposit' ? 'Deposit' : invoice.type === 'staged' ? 'Progress Payment' : 'Final Invoice'}
            </Badge>
          </div>

          {/* Project Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0 break-words [overflow-wrap:anywhere]">
              <p className="text-sm text-muted-foreground">Job</p>
              <p className="font-medium">{project.name}</p>
            </div>
            <div className="min-w-0 break-words [overflow-wrap:anywhere]">
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">{project.clientName}</p>
              <p className="text-sm text-muted-foreground">{project.clientEmail}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Issued Date</p>
              <p className="font-medium">{format(invoice.createdAt, 'dd MMM yyyy')}</p>
            </div>
            {invoice.dueDate && (
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">{format(invoice.dueDate, 'dd MMM yyyy')}</p>
              </div>
            )}
            {invoice.paidAt && (
              <div>
                <p className="text-sm text-muted-foreground">Paid Date</p>
                <p className="font-medium text-approved">{format(invoice.paidAt, 'dd MMM yyyy')}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h4 className="font-semibold mb-3">Line Items</h4>
            <div className="space-y-2">
              {invoice.lineItems.map(item => (
                <div key={item.id} className="flex min-w-0 flex-col items-start gap-2 border-b py-2 last:border-b-0 sm:flex-row sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <RichTextContent html={item.description} className="break-words font-medium [overflow-wrap:anywhere]" />
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} × ${item.unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="break-words font-medium sm:pl-3">
                    ${item.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-right">${invoice.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
              <span className="text-right">${invoice.taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="break-words text-right text-primary">
                ${invoice.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {invoice.amountPaid > 0 && invoice.amountPaid < invoice.total && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="break-words text-right text-approved">
                  ${invoice.amountPaid.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          {invoice.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Payment Instructions</h4>
                <RichTextContent html={invoice.notes} className="break-words [overflow-wrap:anywhere]" />
              </div>
            </>
          )}

          {/* Terms */}
          {invoice.terms && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Terms & Conditions</h4>
                <RichTextContent html={invoice.terms} className="break-words [overflow-wrap:anywhere]" />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
