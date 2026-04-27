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
  CheckCircle2,
  XCircle,
  Send,
  Edit,
  RefreshCw,
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
  projectInfo,
}: QuoteViewModalProps) {
  const excludedItems = scopeItems.filter(item => item.category === 'excluded');
  const assumptionItems = scopeItems.filter(item => item.category === 'assumption');
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');
  const approvedChangeCosts = new Set(approvedChanges.map(cr => cr.costImpact));

  const includedItems = scopeItems.filter(item => item.category === 'included' && !isVariationItem(item.title) && !approvedChangeCosts.has(item.cost ?? -1));
  const scopeSubtotal = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const changesImpact = approvedChanges.reduce((sum, cr) => sum + cr.costImpact, 0);
  const baseQuoteLineItems = quoteLineItems.filter(item => !isVariationItem(item.title) && !approvedChangeCosts.has(item.cost));
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
    return format(d, 'd MMM yyyy');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          {/* Required for accessibility — visually hidden since we render our own heading below */}
          <DialogTitle className="sr-only">{quote.quoteNumber}</DialogTitle>

          {/* ── Header bar: QUOTE title + status ── */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-bold tracking-tight">QUOTE</h2>
            <div className="flex items-center gap-3">
              <Badge variant={config.variant} className="gap-1.5">
                <StatusIcon className="w-3.5 h-3.5" />
                {config.label}
              </Badge>
            </div>
          </div>

          {/* ── Three-column info block (mirrors PDF) ── */}
          <div className="grid grid-cols-3 gap-6 p-4 rounded-lg bg-muted/40 border text-sm">
            {/* Col 1 — Client */}
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">{projectInfo.clientName}</p>
              {projectInfo.clientAddress && (
                <p className="text-muted-foreground whitespace-pre-line">{projectInfo.clientAddress}</p>
              )}
              {projectInfo.clientEmail && (
                <p className="text-muted-foreground">{projectInfo.clientEmail}</p>
              )}
            </div>

            {/* Col 2 — Date, Quote Number, Reference, ABN */}
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Date</p>
                <p className="text-foreground">{formatDate(quote.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Quote Number</p>
                <p className="text-foreground font-medium">{quote.quoteNumber}</p>
              </div>
              {quote.reference && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Reference</p>
                  <p className="text-foreground">{quote.reference}</p>
                </div>
              )}
              {projectInfo.abn && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-0.5">ABN</p>
                  <p className="text-foreground">{projectInfo.abn}</p>
                </div>
              )}
              {quote.validUntil && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Valid Until</p>
                  <p className="text-foreground">{formatDate(quote.validUntil)}</p>
                </div>
              )}
            </div>

            {/* Col 3 — Business / trade contact */}
            <div className="space-y-0.5 text-right">
              {projectInfo.logoUrl ? (
                <img
                  src={projectInfo.logoUrl}
                  alt="Business logo"
                  className="max-h-12 max-w-full object-contain ml-auto mb-2"
                />
              ) : projectInfo.tradeBusinessName ? (
                <p className="font-semibold text-foreground">{projectInfo.tradeBusinessName}</p>
              ) : null}
              {projectInfo.tradeBusinessName && projectInfo.logoUrl && (
                <p className="font-semibold text-foreground">{projectInfo.tradeBusinessName}</p>
              )}
              {projectInfo.tradeAddress && (
                <p className="text-muted-foreground whitespace-pre-line">{projectInfo.tradeAddress}</p>
              )}
              {projectInfo.tradePhone && (
                <p className="text-muted-foreground">Ph: {projectInfo.tradePhone}</p>
              )}
              {projectInfo.tradeWebsite && (
                <p className="text-muted-foreground">{projectInfo.tradeWebsite}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
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
          {approvedChanges.length > 0 && (
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
              <span className="text-muted-foreground">TOTAL GST {quote.taxRate}%</span>
              <span>${taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-lg font-bold">
              <span>TOTAL AUD</span>
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

          {/* Download */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleDownloadPDF} className="gap-2" data-testid="button-download-pdf">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
