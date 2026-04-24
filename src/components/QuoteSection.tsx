import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Quote, ScopeItem, ChangeRequest, QuoteLineItem } from '@/types/project';
import { 
  FileText, 
  Send, 
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Calendar,
  Edit,
  Eye,
  Download,
  Trash2,
  Lock,
} from 'lucide-react';
import { exportQuoteToXeroCSV, downloadCSV } from '@/lib/xeroExport';
import { downloadQuotePDF } from '@/lib/quotePdf';
import { QuoteViewModal } from '@/components/QuoteViewModal';
import { toast } from 'sonner';
import { cn, cleanVariationTitle } from '@/lib/utils';
import { format } from 'date-fns';

interface QuoteSectionProps {
  quote: Quote | null;
  scopeItems: ScopeItem[];
  changeRequests: ChangeRequest[];
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  projectName?: string;
  tradeBusinessName?: string;
  tradeName?: string;
  tradeAddress?: string;
  tradePhone?: string;
  tradeWebsite?: string;
  tradeAbn?: string;
  logoUrl?: string;
  // Quote line items (custom items added directly to quote)
  quoteLineItems?: QuoteLineItem[];
  onAddLineItem?: (item: { title: string; description?: string; cost: number }) => Promise<string | null>;
  onUpdateLineItem?: (itemId: string, data: Partial<{ title: string; description: string; cost: number }>) => Promise<boolean>;
  onDeleteLineItem?: (itemId: string) => Promise<boolean>;
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
  clientAddress,
  projectName = '',
  tradeBusinessName = '',
  tradeName = '',
  tradeAddress = '',
  tradePhone = '',
  tradeWebsite = '',
  tradeAbn = '',
  logoUrl = '',
  quoteLineItems = [],
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
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
  
  // New line item form state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemCost, setNewItemCost] = useState('');
  
  // Editing existing line item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemTitle, setEditItemTitle] = useState('');
  const [editItemDescription, setEditItemDescription] = useState('');
  const [editItemCost, setEditItemCost] = useState('');

  // Sync state when quote prop changes (fix for editing not working)
  useEffect(() => {
    if (quote) {
      setTaxRate(quote.taxRate ?? 10);
      setNotes(quote.notes ?? '');
      setTerms(quote.terms ?? '');
      setValidUntil(quote.validUntil ? format(quote.validUntil, 'yyyy-MM-dd') : '');
    }
  }, [quote]);

  // Calculate totals from scope items
  const includedItems = scopeItems.filter(item => item.category === 'included');
  const scopeSubtotal = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  
  // Add approved change request impacts
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');
  const changesImpact = approvedChanges.reduce((sum, cr) => sum + cr.costImpact, 0);
  
  // Add custom quote line items
  const customItemsTotal = quoteLineItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  
  const subtotal = scopeSubtotal + changesImpact + customItemsTotal;
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

  const handleDownloadPDF = async () => {
    if (!quote) return;
    try {
      await downloadQuotePDF(
        quote,
        {
          name: projectName,
          clientName,
          clientEmail,
          clientAddress,
          tradeBusinessName,
          tradeName,
          tradeAddress: tradeAddress || undefined,
          tradePhone: tradePhone || undefined,
          tradeWebsite: tradeWebsite || undefined,
          abn: tradeAbn || undefined,
        },
        scopeItems,
        changeRequests,
        quoteLineItems,
        logoUrl || undefined
      );
      toast.success('Quote PDF downloaded');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  const handleAddLineItem = async () => {
    if (!onAddLineItem || !newItemTitle.trim()) return;
    
    const cost = parseFloat(newItemCost) || 0;
    const result = await onAddLineItem({
      title: newItemTitle.trim(),
      description: newItemDescription.trim() || undefined,
      cost,
    });
    
    if (result) {
      setNewItemTitle('');
      setNewItemDescription('');
      setNewItemCost('');
      setIsAddingItem(false);
      toast.success('Line item added');
    }
  };

  const handleStartEditItem = (item: QuoteLineItem) => {
    setEditingItemId(item.id);
    setEditItemTitle(item.title);
    setEditItemDescription(item.description || '');
    setEditItemCost(item.cost.toString());
  };

  const handleSaveEditItem = async () => {
    if (!onUpdateLineItem || !editingItemId || !editItemTitle.trim()) return;
    
    const success = await onUpdateLineItem(editingItemId, {
      title: editItemTitle.trim(),
      description: editItemDescription.trim(),
      cost: parseFloat(editItemCost) || 0,
    });
    
    if (success) {
      setEditingItemId(null);
      toast.success('Line item updated');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!onDeleteLineItem) return;
    
    const success = await onDeleteLineItem(itemId);
    if (success) {
      toast.success('Line item deleted');
    }
  };

  const projectInfo = {
    name: projectName,
    clientName,
    clientEmail,
    clientAddress,
    tradeBusinessName,
    tradeName,
    tradeAddress: tradeAddress || undefined,
    tradePhone: tradePhone || undefined,
    tradeWebsite: tradeWebsite || undefined,
    abn: tradeAbn || undefined,
    logoUrl: logoUrl || undefined,
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
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Line Items
            </h4>
            {onAddLineItem && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsAddingItem(true)}
                disabled={isAddingItem}
                data-testid="button-add-line-item"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            )}
          </div>
          
          {/* Approved Variations — separate green section above the editable items */}
          {approvedChanges.length > 0 && (
            <div className="border border-approved/30 rounded-lg divide-y bg-approved/5 mb-3">
              <div className="px-3 py-2 border-b border-approved/20 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-approved" />
                <span className="text-xs font-semibold text-approved uppercase tracking-wide">Approved Variations (read-only)</span>
              </div>
              {approvedChanges.map(change => (
                <div key={change.id} className="p-3">
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
            </div>
          )}

          <div className="border rounded-lg divide-y">
            {/* Scope Items (read-only) */}
            {includedItems.length > 0 && (
              <>
                <div className="p-3 bg-muted/50">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5" />
                    From Scope (read-only)
                  </span>
                </div>
                {includedItems.map(item => (
                  <div key={item.id} className="p-3 bg-muted/20">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <span className="text-sm font-medium">{cleanVariationTitle(item.title)}</span>
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
              </>
            )}

            {/* Custom Quote Line Items (editable) */}
            {(quoteLineItems.length > 0 || isAddingItem) && (
              <>
                <div className="p-3 bg-primary/5">
                  <span className="text-sm font-medium text-primary">
                    Custom Line Items
                  </span>
                </div>
                {quoteLineItems.map(item => (
                  <div key={item.id} className="p-3">
                    {editingItemId === item.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Input
                            placeholder="Item title"
                            value={editItemTitle}
                            onChange={(e) => setEditItemTitle(e.target.value)}
                            className="sm:col-span-2"
                          />
                          <Input
                            type="number"
                            placeholder="Cost"
                            value={editItemCost}
                            onChange={(e) => setEditItemCost(e.target.value)}
                          />
                        </div>
                        <Textarea
                          placeholder="Description (optional)"
                          value={editItemDescription}
                          onChange={(e) => setEditItemDescription(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEditItem}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingItemId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-4">
                          <span className="text-sm font-medium">{cleanVariationTitle(item.title)}</span>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium whitespace-nowrap">
                            ${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                          </span>
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleStartEditItem(item)}
                              data-testid={`button-edit-lineitem-${item.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteItem(item.id)}
                              data-testid={`button-delete-lineitem-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Add new item form */}
                {isAddingItem && (
                  <div className="p-3 space-y-3 bg-secondary/30">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        placeholder="Item title"
                        value={newItemTitle}
                        onChange={(e) => setNewItemTitle(e.target.value)}
                        className="sm:col-span-2"
                      />
                      <Input
                        type="number"
                        placeholder="Cost"
                        value={newItemCost}
                        onChange={(e) => setNewItemCost(e.target.value)}
                      />
                    </div>
                    <Textarea
                      placeholder="Description (optional)"
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddLineItem} disabled={!newItemTitle.trim()}>
                        Add Item
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setIsAddingItem(false);
                        setNewItemTitle('');
                        setNewItemDescription('');
                        setNewItemCost('');
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {includedItems.length === 0 && approvedChanges.length === 0 && quoteLineItems.length === 0 && !isAddingItem && (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No line items yet. Add scope items or custom line items.</p>
              </div>
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

        {/* Included Items — scope + custom line items merged */}
        {(includedItems.length > 0 || quoteLineItems.length > 0) && (
          <div className="border rounded-lg divide-y mb-4">
            {includedItems.map(item => (
              <div key={item.id} className="p-3 flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <span className="text-sm font-medium">{cleanVariationTitle(item.title)}</span>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
            {quoteLineItems.map(item => (
              <div key={item.id} className="p-3 flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <span className="text-sm font-medium">{cleanVariationTitle(item.title)}</span>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Approved Variations — separate green section */}
        {approvedChanges.length > 0 && (
          <div className="border border-approved/30 rounded-lg divide-y bg-approved/5 mb-6">
            <div className="px-3 py-2 border-b border-approved/20">
              <span className="text-xs font-semibold text-approved uppercase tracking-wide">Approved Variations</span>
            </div>
            {approvedChanges.map(change => (
              <div key={change.id} className="p-3 flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <span className="text-sm font-medium">{change.title}</span>
                  {change.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{change.description}</p>
                  )}
                </div>
                <span className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  change.costImpact > 0 ? "text-approved" : change.costImpact < 0 ? "text-destructive" : ""
                )}>
                  {change.costImpact > 0 ? '+' : ''}${change.costImpact.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Totals - Always use live calculated values */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({quote!.taxRate}%)</span>
            <span>${taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
            <span>Total</span>
            <span className="text-primary">
              ${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Valid Until */}
        {quote!.validUntil && (
          <div className="mt-4 flex items-center gap-2 text-sm border-t pt-4">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Valid until:</span>
            <span>{format(quote!.validUntil, 'dd MMM yyyy')}</span>
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
            {(quote!.status === 'declined' || quote!.status === 'revised') && (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Quote
                </Button>
                <Button onClick={handleReviseQuote}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Create Revised Quote
                </Button>
              </>
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
          quoteLineItems={quoteLineItems}
          projectInfo={projectInfo}
        />
      )}
    </div>
  );
}
