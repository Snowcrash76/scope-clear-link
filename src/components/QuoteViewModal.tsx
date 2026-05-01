import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Quote, ScopeItem, ChangeRequest } from '@/types/project';
import { RichTextContent, htmlToText } from '@/components/RichTextEditor';
import { QuoteLineItem } from '@/hooks/useQuoteLineItems';
import { 
  Download, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Send, 
  Edit, 
  RefreshCw,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn, isVariationItem, stripVariationMeta } from '@/lib/utils';
import { downloadQuotePDF } from '@/lib/quotePdf';

interface QuoteViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote;
  scopeItems: ScopeItem[];
  changeRequests: ChangeRequest[];
  quoteLineItems?: QuoteLineItem[];
  isDemo?: boolean;
  projectInfo: {
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
  };
}

export function QuoteViewModal({
  isOpen,
  onClose,
  quote,
  scopeItems,
  changeRequests,
  quoteLineItems = [],
  isDemo = false,
  projectInfo,
}: QuoteViewModalProps) {
  const excludedItems = scopeItems.filter(item => item.category === 'excluded');
  const assumptionItems = scopeItems.filter(item => item.category === 'assumption');
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');
  const approvedChangeCosts = new Set(approvedChanges.map(cr => cr.costImpact));

  const includedItems = scopeItems.filter(item => item.category === 'included' && !isVariationItem(item.title) && !approvedChangeCosts.has(item.cost ?? -1));
  const scopeSubtotal = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const changesImpact = approvedChanges.reduce((sum, cr) => sum + cr.costImpact, 0);
  const baseQuoteLineItems = quoteLineItems.filter(item => !item.isVariation && !approvedChangeCosts.has(item.cost));
  const variationLineItems = quoteLineItems.filter(item => item.isVariation);
  const customItemsTotal = baseQuoteLineItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const subtotal = scopeSubtotal + changesImpact + customItemsTotal;
  const taxAmount = subtotal * (quote.taxRate / 100);
  const total = subtotal + taxAmount;

  const statusConfig = {
    draft: { label: 'Draft', variant: 'secondary' as const, icon: Edit },
    sent: { label: 'Sent', variant: 'pending' as const, icon: Send },
    approved: { label: 'Approved', variant: 'success' as const, icon: CheckCircle2 },
    declined: { label: 'Declined', variant: 'destructive' as const, icon: XCircle },
    revised: { label: 'Revised', variant: 'outline' as const, icon: RefreshCw },
  };

  const config = statusConfig[quote.status];
  const StatusIcon = config.icon;

  const handleDownloadPDF = async () => {
    try {
      const { logoUrl, ...restInfo } = projectInfo;
      await downloadQuotePDF(quote, restInfo, scopeItems, changeRequests, quoteLineItems, logoUrl);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return format(d, 'dd MMM yyyy');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">{quote.quoteNumber}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Created {formatDate(quote.createdAt)}
                </p>
              </div>
            </div>
            <Badge variant={config.variant} className="gap-1.5">
              <StatusIcon className="w-3.5 h-3.5" />
              {config.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Project, Client & Quote Info */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Project</p>
              <p className="font-medium">{projectInfo.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Client</p>
              <p className="font-medium">{projectInfo.clientName}</p>
              <p className="text-sm text-muted-foreground">{projectInfo.clientEmail}</p>
            </div>
            {quote.reference && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reference</p>
                <p className="font-medium">{quote.reference}</p>
              </div>
            )}
            {projectInfo.abn && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">ABN</p>
                <p className="font-medium">{projectInfo.abn}</p>
              </div>
            )}
          </div>

          {quote.validUntil && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Valid until:</span>
              <span className="font-medium">{formatDate(quote.validUntil)}</span>
            </div>
          )}

          <Separator />

          {/* Included Items */}
          {(includedItems.length > 0 || baseQuoteLineItems.length > 0) && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Included Items
              </h4>
              <div className="border rounded-lg divide-y">
                {includedItems.map(item => (
                  <div key={item.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <p className="text-base font-semibold text-foreground">{item.title}</p>
                        {stripVariationMeta(item.description) && (
                          <RichTextContent html={stripVariationMeta(item.description)} className="mt-1.5" />
                        )}
                      </div>
                      <span className="font-medium whitespace-nowrap">
                        ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
                {baseQuoteLineItems.map(item => (
                  <div key={item.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <p className="text-base font-semibold text-foreground">{item.title}</p>
                        {stripVariationMeta(item.description) && (
                          <RichTextContent html={stripVariationMeta(item.description)} className="mt-1.5" />
                        )}
                      </div>
                      <span className="font-medium whitespace-nowrap">
                        ${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Variations */}
          {(approvedChanges.length > 0 || variationLineItems.length > 0) && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Approved Variations
              </h4>
              <div className="border rounded-lg divide-y border-approved/30 bg-approved/5">
                {approvedChanges.map(change => (
                  <div key={change.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <p className="text-base font-semibold text-foreground">{change.title}</p>
                        {stripVariationMeta(change.description) && (
                          <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">
                            {stripVariationMeta(change.description)}
                          </p>
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
                {variationLineItems.map(item => (
                  <div key={item.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <p className="text-base font-semibold text-foreground">{item.title}</p>
                        {item.description && (
                          <RichTextContent html={item.description} className="mt-1.5" />
                        )}
                      </div>
                      <span className="font-medium whitespace-nowrap text-approved">
                        +${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exclusions */}
          {excludedItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Exclusions
              </h4>
              <div className="space-y-2">
                {excludedItems.map(item => (
                  <div key={item.id} className="p-3 rounded-lg bg-muted/30">
                    <p className="text-base font-semibold text-foreground">{item.title}</p>
                    {stripVariationMeta(item.description) && (
                      <RichTextContent html={stripVariationMeta(item.description)} className="mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assumptions */}
          {assumptionItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Assumptions
              </h4>
              <div className="space-y-2">
                {assumptionItems.map(item => (
                  <div key={item.id} className="p-3 rounded-lg bg-muted/30">
                    <p className="font-medium text-sm">{item.title}</p>
                    {stripVariationMeta(item.description) && (
                      <RichTextContent html={stripVariationMeta(item.description)} className="mt-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Totals */}
          <div className="space-y-2 p-4 rounded-lg bg-muted/50">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({quote.taxRate}%)</span>
              <span>${taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">
                ${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Notes</h4>
                <RichTextContent html={quote.notes} />
              </div>
            </>
          )}

          {/* Terms */}
          {quote.terms && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Terms & Conditions</h4>
                <RichTextContent html={quote.terms} />
              </div>
            </>
          )}

          {/* Download Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={handleDownloadPDF} className="gap-2" disabled={isDemo} title={isDemo ? 'Not available in demo' : undefined}>
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
