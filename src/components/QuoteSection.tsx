import { useState, useEffect } from 'react';
import { useLineItemHistory, formatHistoryEntry } from '@/hooks/useLineItemHistory';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor, RichTextContent, htmlToText } from '@/components/RichTextEditor';
import { EditScopeItemModal } from '@/components/EditScopeItemModal';
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
  Pencil,
  Check,
  X,
  MoveRight,
  Package,
  Ban,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { exportQuoteToXeroCSV, downloadCSV } from '@/lib/xeroExport';
import { downloadQuotePDF } from '@/lib/quotePdf';
import { QuoteViewModal } from '@/components/QuoteViewModal';
import { toast } from 'sonner';
import { cn, cleanVariationTitle, isVariationItem, stripVariationMeta } from '@/lib/utils';
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
  onAddLineItem?: (item: { title: string; description?: string; cost: number; isVariation?: boolean }) => Promise<string | null>;
  onUpdateLineItem?: (itemId: string, data: Partial<{ title: string; description: string; cost: number; isVariation: boolean }>) => Promise<boolean>;
  onDeleteLineItem?: (itemId: string) => Promise<boolean>;
  onCreateQuote: (data: {
    subtotal: number;
    taxRate: number;
    notes?: string;
    terms?: string;
    validUntil?: Date;
  }) => Promise<string | null>;
  onUpdateQuote: (quoteId: string, data: Partial<{
    quoteNumber: string;
    reference: string;
    subtotal: number;
    taxRate: number;
    notes: string;
    terms: string;
    validUntil: Date;
  }>) => Promise<boolean>;
  onSendQuote: (quoteId: string) => Promise<boolean>;
  onReviseQuote: (quoteId: string) => Promise<boolean>;
  defaultTerms?: string;
  isTradeView?: boolean;
  onSaveScopeItem?: (item: Omit<ScopeItem, 'id' | 'acknowledged'> & { id?: string }) => Promise<boolean | void>;
  onDeleteScopeItem?: (itemId: string) => Promise<boolean | void>;
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
  defaultTerms,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
  onCreateQuote,
  onUpdateQuote,
  onSendQuote,
  onReviseQuote,
  isTradeView = true,
  onSaveScopeItem,
  onDeleteScopeItem,
}: QuoteSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  // Scope item editing (inline from Quote tab)
  const [editingScopeItem, setEditingScopeItem] = useState<ScopeItem | undefined>();
  const [isAddingScopeItem, setIsAddingScopeItem] = useState(false);
  const [addScopeItemCategory, setAddScopeItemCategory] = useState<'included' | 'excluded' | 'assumption'>('included');
  const [isExclusionsOpen, setIsExclusionsOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(quote?.taxRate ?? 10);
  const [notes, setNotes] = useState(quote?.notes ?? '');
  const [terms, setTerms] = useState(quote?.terms || defaultTerms || '');
  const [validUntil, setValidUntil] = useState<string>(
    quote?.validUntil ? format(quote.validUntil, 'yyyy-MM-dd') : ''
  );
  const [isSaving, setIsSaving] = useState(false);

  // Inline reference editing state (read view)
  const [editingRef, setEditingRef] = useState(false);
  const [quoteRef, setQuoteRef] = useState(quote?.reference ?? '');
  const [isSavingRef, setIsSavingRef] = useState(false);
  
  // New line item form state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemIsVariation, setNewItemIsVariation] = useState(false);
  
  // Editing existing line item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemTitle, setEditItemTitle] = useState('');
  const [editItemDescription, setEditItemDescription] = useState('');
  const [editItemCost, setEditItemCost] = useState('');
  const [editItemIsVariation, setEditItemIsVariation] = useState(false);

  // Line item history (inline expansion)
  const [expandedHistoryItemId, setExpandedHistoryItemId] = useState<string | null>(null);
  const { history: lineItemHistory, refetch: refetchHistory } = useLineItemHistory(quote?.id);

  // Sync state when quote prop changes (fix for editing not working)
  useEffect(() => {
    if (quote && !isEditing && !isCreating) {
      setTaxRate(quote.taxRate ?? 10);
      setNotes(quote.notes ?? '');
      setTerms(quote.terms || defaultTerms || '');
      setValidUntil(quote.validUntil ? format(quote.validUntil, 'yyyy-MM-dd') : '');
      setQuoteRef(quote.reference ?? '');
    }
  }, [quote, isEditing, isCreating, defaultTerms]);

  // When business defaults load asynchronously, seed terms if the quote has none
  useEffect(() => {
    if (defaultTerms && !quote?.terms && !isEditing && !isCreating) {
      setTerms(prev => prev || defaultTerms);
    }
  }, [defaultTerms, quote?.terms, isEditing, isCreating]);

  // Build approved-variation cost set first so all filters can use it
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');
  const approvedChangeCosts = new Set(approvedChanges.map(cr => cr.costImpact));
  const changesImpact = approvedChanges.reduce((sum, cr) => sum + cr.costImpact, 0);

  // Calculate totals from scope items — exclude variation duplicates (by title prefix or matching cost)
  const includedItems = scopeItems.filter(item => item.category === 'included' && !isVariationItem(item.title) && !approvedChangeCosts.has(item.cost ?? -1));
  const excludedScopeItems = scopeItems.filter(item => item.category === 'excluded');
  const assumptionScopeItems = scopeItems.filter(item => item.category === 'assumption');
  const scopeSubtotal = includedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  
  // Split custom quote line items into base items and variation items
  const baseQuoteLineItems = quoteLineItems.filter(item => !item.isVariation && !approvedChangeCosts.has(item.cost));
  const variationLineItems = quoteLineItems.filter(item => item.isVariation);
  const customItemsTotal = baseQuoteLineItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  
  const subtotal = scopeSubtotal + changesImpact + customItemsTotal;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleCreateQuote = async () => {
    setIsSaving(true);
    try {
      const quoteId = await onCreateQuote({
        subtotal,
        taxRate,
        notes: notes || undefined,
        terms: terms || undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
      });
      if (quoteId) setIsCreating(false);
    } finally { setIsSaving(false); }
  };

  const handleUpdateQuote = async () => {
    if (!quote) return;
    setIsSaving(true);
    const needsRevision = quote.status === 'sent' || quote.status === 'approved';
    const success = await onUpdateQuote(quote.id, {
      reference: quoteRef.trim() || null,
      subtotal,
      taxRate,
      notes,
      terms,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      ...(needsRevision ? { status: 'revised' } : {}),
    });
    setIsSaving(false);
    if (success) {
      setIsEditing(false);
      if (needsRevision) {
        toast.info('Quote saved — notify the client to request their re-approval.');
      }
    }
  };

  const handleSaveRef = async () => {
    if (!quote) return;
    setIsSavingRef(true);
    const success = await onUpdateQuote(quote.id, { reference: quoteRef.trim() });
    setIsSavingRef(false);
    if (success) setEditingRef(false);
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
      isVariation: newItemIsVariation,
    });
    
    if (result) {
      setNewItemTitle('');
      setNewItemDescription('');
      setNewItemCost('');
      setNewItemIsVariation(false);
      setIsAddingItem(false);
      toast.success('Line item added');
      setTimeout(refetchHistory, 600);
    }
  };

  const handleStartEditItem = (item: QuoteLineItem) => {
    setEditingItemId(item.id);
    setEditItemTitle(item.title);
    setEditItemDescription(item.description || '');
    setEditItemCost(item.cost.toString());
    setEditItemIsVariation(item.isVariation);
  };

  const handleSaveEditItem = async () => {
    if (!onUpdateLineItem || !editingItemId || !editItemTitle.trim()) return;
    
    const success = await onUpdateLineItem(editingItemId, {
      title: editItemTitle.trim(),
      description: editItemDescription.trim(),
      cost: parseFloat(editItemCost) || 0,
      isVariation: editItemIsVariation,
    });
    
    if (success) {
      setEditingItemId(null);
      toast.success('Line item updated');
      setTimeout(refetchHistory, 600);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!onDeleteLineItem) return;
    
    const success = await onDeleteLineItem(itemId);
    if (success) {
      toast.success('Line item deleted');
      setTimeout(refetchHistory, 600);
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
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Line Items
          </h4>
          
          <div className="border rounded-lg divide-y">
            {/* Included scope items header with add button for trade */}
            <div className="p-3 bg-muted/50 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="w-3.5 h-3.5" />
                Included Items
              </span>
              {isTradeView && onSaveScopeItem && (
                <button
                  type="button"
                  onClick={() => { setAddScopeItemCategory('included'); setIsAddingScopeItem(true); }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  data-testid="button-add-scope-item-included"
                >
                  <Plus className="w-3 h-3" />
                  Add item
                </button>
              )}
            </div>

            {includedItems.map(item => (
              <div key={item.id} className="p-3 bg-muted/20">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <span className="text-sm font-medium">{cleanVariationTitle(item.title)}</span>
                    {stripVariationMeta(item.description) && (
                      <p className="text-xs text-muted-foreground mt-1">{htmlToText(stripVariationMeta(item.description))}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium whitespace-nowrap">
                      ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </span>
                    {isTradeView && onSaveScopeItem && (
                      <button
                        type="button"
                        onClick={() => setEditingScopeItem(item)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                        data-testid={`button-edit-scope-item-${item.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {includedItems.length === 0 && approvedChanges.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No included items yet.</p>
              </div>
            )}
          </div>

          {/* Approved Variations — below the editable items */}
          {approvedChanges.length > 0 && (
            <div className="border border-approved/30 rounded-lg divide-y bg-approved/5">
              <div className="px-3 py-2 border-b border-approved/20 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-approved" />
                <span className="text-xs font-semibold text-approved uppercase tracking-wide">Approved Variations</span>
              </div>
              {approvedChanges.map(change => (
                <div key={change.id} className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <span className="text-sm font-medium">{change.title}</span>
                      {stripVariationMeta(change.description) && (
                        <p className="text-xs text-muted-foreground mt-1">{htmlToText(stripVariationMeta(change.description))}</p>
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
              <div className="p-3 border-t border-approved/20 flex items-center gap-2 text-xs text-muted-foreground">
                <MoveRight className="w-3.5 h-3.5 shrink-0" />
                Approved variations are managed in the Variations tab
              </div>
            </div>
          )}

          {/* Custom Line Items — editable, with variation toggle (only when editing an existing quote) */}
          {isEditing && onAddLineItem && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Additional Items
                </h4>
                {!isAddingItem && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingItem(true)}
                    data-testid="button-add-line-item"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Item
                  </Button>
                )}
              </div>

              {/* Existing custom line items */}
              {quoteLineItems.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {quoteLineItems.map(item => (
                    <div key={item.id} className="p-3">
                      {editingItemId === item.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={editItemTitle}
                              onChange={e => setEditItemTitle(e.target.value)}
                              placeholder="Item title"
                              data-testid={`input-edit-item-title-${item.id}`}
                            />
                            <Input
                              type="number"
                              value={editItemCost}
                              onChange={e => setEditItemCost(e.target.value)}
                              placeholder="Cost"
                              data-testid={`input-edit-item-cost-${item.id}`}
                            />
                          </div>
                          <Textarea
                            value={editItemDescription}
                            onChange={e => setEditItemDescription(e.target.value)}
                            placeholder="Description (optional)"
                            rows={2}
                            data-testid={`input-edit-item-desc-${item.id}`}
                          />
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`edit-variation-${item.id}`}
                              checked={editItemIsVariation}
                              onCheckedChange={v => setEditItemIsVariation(!!v)}
                              data-testid={`checkbox-edit-variation-${item.id}`}
                            />
                            <label htmlFor={`edit-variation-${item.id}`} className="text-sm text-muted-foreground cursor-pointer select-none">
                              Flag as variation
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEditItem} data-testid={`button-save-item-${item.id}`}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingItemId(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{item.title}</span>
                              {item.isVariation && (
                                <Badge variant="outline" className="text-xs border-amber-400/60 text-amber-600 dark:text-amber-400">
                                  Variation
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{htmlToText(item.description)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-medium whitespace-nowrap">
                              ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditItem(item)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                              data-testid={`button-edit-item-${item.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              data-testid={`button-delete-item-${item.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new item form */}
              {isAddingItem && (
                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      value={newItemTitle}
                      onChange={e => setNewItemTitle(e.target.value)}
                      placeholder="Item title"
                      autoFocus
                      data-testid="input-new-item-title"
                    />
                    <Input
                      type="number"
                      value={newItemCost}
                      onChange={e => setNewItemCost(e.target.value)}
                      placeholder="Cost"
                      data-testid="input-new-item-cost"
                    />
                  </div>
                  <Textarea
                    value={newItemDescription}
                    onChange={e => setNewItemDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    data-testid="input-new-item-description"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="new-item-variation"
                      checked={newItemIsVariation}
                      onCheckedChange={v => setNewItemIsVariation(!!v)}
                      data-testid="checkbox-new-item-variation"
                    />
                    <label htmlFor="new-item-variation" className="text-sm text-muted-foreground cursor-pointer select-none">
                      Flag as variation
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddLineItem} disabled={!newItemTitle.trim()} data-testid="button-confirm-add-item">
                      Add Item
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setIsAddingItem(false); setNewItemTitle(''); setNewItemDescription(''); setNewItemCost(''); setNewItemIsVariation(false); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
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
          {isEditing && (
            <div className="space-y-3">
              <div>
                <Label>Quote Number</Label>
                <p className="text-sm font-medium text-muted-foreground mt-1 px-3 py-2 rounded-md bg-secondary/40 border border-border/50">{quote!.quoteNumber}</p>
              </div>
              <div>
                <Label htmlFor="quoteRef">Reference</Label>
                <Input
                  id="quoteRef"
                  value={quoteRef}
                  onChange={e => setQuoteRef(e.target.value)}
                  placeholder="e.g. job address or custom note"
                  data-testid="input-quote-ref-edit"
                />
              </div>
            </div>
          )}

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
            <RichTextEditor
              value={notes}
              onChange={setNotes}
              placeholder="Additional notes for the client..."
            />
          </div>

          <div>
            <Label htmlFor="terms">Terms & Conditions</Label>
            <RichTextEditor
              value={terms}
              onChange={setTerms}
              placeholder="Payment terms, warranty, etc..."
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
      {/* Revised banner — trade view only */}
      {isTradeView && quote!.status === 'revised' && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Client re-approval required</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              This quote has been edited since it was last sent. Notify the client to request their re-approval.
            </p>
          </div>
        </div>
      )}
      {/* Quote Header */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex flex-col gap-0.5">
                <h3 className="font-heading font-semibold">{quote!.quoteNumber}</h3>
                {editingRef ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={quoteRef}
                      onChange={e => setQuoteRef(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveRef();
                        if (e.key === 'Escape') { setEditingRef(false); setQuoteRef(quote!.reference ?? ''); }
                      }}
                      className="h-6 text-xs w-44"
                      autoFocus
                      placeholder="e.g. job address or note"
                      data-testid="input-quote-reference"
                    />
                    <button
                      onClick={handleSaveRef}
                      disabled={isSavingRef}
                      className="p-1 rounded hover:bg-muted transition-colors text-primary"
                      data-testid="button-save-quote-reference"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => { setEditingRef(false); setQuoteRef(quote!.reference ?? ''); }}
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                      data-testid="button-cancel-quote-reference"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group/ref">
                    {(quote!.reference || isTradeView) && (
                      <p className="text-xs text-muted-foreground">
                        {quote!.reference || <span className="italic opacity-60">Add reference</span>}
                      </p>
                    )}
                    {isTradeView && (
                      <button
                        onClick={() => setEditingRef(true)}
                        className="p-0.5 rounded opacity-0 group-hover/ref:opacity-100 hover:bg-muted transition-all text-muted-foreground"
                        title="Edit reference"
                        data-testid="button-edit-quote-reference"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
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

        {/* Actions (Trade View) */}
        {isTradeView && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsViewModalOpen(true)}>
              <Eye className="w-4 h-4 mr-2" />
              View Quote
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            {quote!.status === 'draft' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Quote
                </Button>
                <Button size="sm" onClick={handleSendQuote}>
                  <Send className="w-4 h-4 mr-2" />
                  Send to Client
                </Button>
              </>
            )}
            {quote!.status === 'sent' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Quote
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportToXero}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export to Xero
                </Button>
              </>
            )}
            {quote!.status === 'approved' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Quote
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportToXero}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export to Xero
                </Button>
              </>
            )}
            {quote!.status === 'revised' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Quote
                </Button>
                <Button size="sm" onClick={handleSendQuote}>
                  <Send className="w-4 h-4 mr-2" />
                  Notify Client &amp; Request Approval
                </Button>
              </>
            )}
            {quote!.status === 'declined' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Quote
                </Button>
                <Button size="sm" onClick={handleReviseQuote}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Create Revised Quote
                </Button>
              </>
            )}
          </div>
        )}

        {/* Client View - View and Download buttons */}
        {!isTradeView && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsViewModalOpen(true)}>
              <Eye className="w-4 h-4 mr-2" />
              View Quote
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        )}

        {/* Included Items — scope + custom line items merged (no variation duplicates) */}
        {(includedItems.length > 0 || baseQuoteLineItems.length > 0 || (isTradeView && onSaveScopeItem)) && (
          <div className="border rounded-lg divide-y mb-4">
            {isTradeView && onSaveScopeItem && (
              <div className="px-3 py-2 bg-muted/30 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setAddScopeItemCategory('included'); setIsAddingScopeItem(true); }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  data-testid="button-add-scope-item-read"
                >
                  <Plus className="w-3 h-3" />
                  Include item
                </button>
              </div>
            )}
            {includedItems.map(item => (
              <div key={item.id} className="p-3 flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <span className="text-sm font-medium">{cleanVariationTitle(item.title)}</span>
                  {stripVariationMeta(item.description) && (
                    <RichTextContent html={stripVariationMeta(item.description)} className="text-xs mt-0.5" />
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium whitespace-nowrap">
                    ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                  {isTradeView && onSaveScopeItem && (
                    <button
                      type="button"
                      onClick={() => setEditingScopeItem(item)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                      data-testid={`button-edit-scope-item-read-${item.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {baseQuoteLineItems.map(item => {
              const itemHistory = lineItemHistory.filter(h => h.lineItemId === item.id);
              const hasHistory = itemHistory.length > 0;
              const isExpanded = expandedHistoryItemId === item.id;
              return (
                <div key={item.id} className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 pr-2 min-w-0">
                      <span className="text-sm font-medium">{cleanVariationTitle(item.title)}</span>
                      {stripVariationMeta(item.description) && (
                        <RichTextContent html={stripVariationMeta(item.description)} className="text-xs mt-0.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-sm font-medium whitespace-nowrap">
                        ${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </span>
                      {hasHistory && isTradeView && (
                        <button
                          type="button"
                          onClick={() => setExpandedHistoryItemId(isExpanded ? null : item.id)}
                          className={cn(
                            'p-1 rounded transition-colors',
                            isExpanded
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                          title="View change history"
                          data-testid={`button-item-history-${item.id}`}
                        >
                          <Clock className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-dashed space-y-1">
                      {itemHistory.map(h => (
                        <div key={h.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-60" />
                          <div className="flex-1 min-w-0">
                            <span>{formatHistoryEntry(h)}</span>
                            <span className="ml-2 opacity-60">
                              {h.createdAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' '}
                              {h.createdAt.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Approved Variations — separate green section */}
        {(approvedChanges.length > 0 || variationLineItems.length > 0) && (
          <div className="border border-approved/30 rounded-lg divide-y bg-approved/5 mb-6">
            <div className="px-3 py-2 border-b border-approved/20">
              <span className="text-xs font-semibold text-approved uppercase tracking-wide">Approved Variations</span>
            </div>
            {approvedChanges.map(change => (
              <div key={change.id} className="p-3 flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <span className="text-sm font-medium">{change.title}</span>
                  {stripVariationMeta(change.description) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{htmlToText(stripVariationMeta(change.description))}</p>
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
            {variationLineItems.map(item => {
              const itemHistory = lineItemHistory.filter(h => h.lineItemId === item.id);
              const isExpanded = expandedHistoryItemId === item.id;
              return (
                <div key={item.id} className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 pr-2 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">{item.title}</span>
                        {itemHistory.length > 0 && isTradeView && (
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryItemId(isExpanded ? null : item.id)}
                            className={cn(
                              'p-1 rounded transition-colors',
                              isExpanded
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                            title="View change history"
                            data-testid={`button-item-history-${item.id}`}
                          >
                            <Clock className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {item.description && (
                        <RichTextContent html={item.description} className="text-xs mt-0.5" />
                      )}
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap text-approved">
                      +${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-dashed space-y-1">
                      {itemHistory.map(h => (
                        <div key={h.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-60" />
                          <div className="flex-1 min-w-0">
                            <span>{formatHistoryEntry(h)}</span>
                            <span className="ml-2 opacity-60">
                              {h.createdAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' '}
                              {h.createdAt.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
      </Card>

      {/* Exclusions & Assumptions — collapsible card below the quote */}
      {(excludedScopeItems.length > 0 || assumptionScopeItems.length > 0 || (isTradeView && onSaveScopeItem)) && (
        <div className="border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setIsExclusionsOpen(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
            data-testid="button-toggle-exclusions"
          >
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Exclusions & Assumptions</span>
              {(excludedScopeItems.length + assumptionScopeItems.length) > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {excludedScopeItems.length + assumptionScopeItems.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isExclusionsOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {isExclusionsOpen && (
            <div className="border-t divide-y">
              {/* Excluded items section */}
              {(excludedScopeItems.length > 0 || (isTradeView && onSaveScopeItem)) && (
                <>
                  <div className="px-4 py-2 bg-muted/30 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5" />
                      Not Included
                    </span>
                    {isTradeView && onSaveScopeItem && (
                      <button
                        type="button"
                        onClick={() => { setAddScopeItemCategory('excluded'); setIsAddingScopeItem(true); }}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        data-testid="button-add-excluded-item"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    )}
                  </div>
                  {excludedScopeItems.length === 0 && (
                    <div className="px-4 py-3">
                      <p className="text-sm text-muted-foreground italic">No exclusions added.</p>
                    </div>
                  )}
                  {excludedScopeItems.map(item => (
                    <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {htmlToText(stripVariationMeta(item.description))}
                          </p>
                        )}
                      </div>
                      {isTradeView && onSaveScopeItem && (
                        <button
                          type="button"
                          onClick={() => setEditingScopeItem(item)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors flex-shrink-0"
                          data-testid={`button-edit-excluded-item-${item.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Assumptions section */}
              {(assumptionScopeItems.length > 0 || (isTradeView && onSaveScopeItem)) && (
                <>
                  <div className="px-4 py-2 bg-muted/30 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Assumptions
                    </span>
                    {isTradeView && onSaveScopeItem && (
                      <button
                        type="button"
                        onClick={() => { setAddScopeItemCategory('assumption'); setIsAddingScopeItem(true); }}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        data-testid="button-add-assumption-item"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    )}
                  </div>
                  {assumptionScopeItems.length === 0 && (
                    <div className="px-4 py-3">
                      <p className="text-sm text-muted-foreground italic">No assumptions added.</p>
                    </div>
                  )}
                  {assumptionScopeItems.map(item => (
                    <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {htmlToText(stripVariationMeta(item.description))}
                          </p>
                        )}
                      </div>
                      {isTradeView && onSaveScopeItem && (
                        <button
                          type="button"
                          onClick={() => setEditingScopeItem(item)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors flex-shrink-0"
                          data-testid={`button-edit-assumption-item-${item.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

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

      {/* Scope Item Modal — opened when trade clicks edit/add from the Quote tab */}
      {onSaveScopeItem && (
        <EditScopeItemModal
          open={isAddingScopeItem || !!editingScopeItem}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddingScopeItem(false);
              setEditingScopeItem(undefined);
            }
          }}
          item={editingScopeItem}
          defaultCategory={isAddingScopeItem ? addScopeItemCategory : undefined}
          onSave={async (itemData) => {
            await onSaveScopeItem(itemData);
            setIsAddingScopeItem(false);
            setEditingScopeItem(undefined);
          }}
          onDelete={editingScopeItem && onDeleteScopeItem ? async (itemId) => {
            await onDeleteScopeItem(itemId);
            setEditingScopeItem(undefined);
          } : undefined}
        />
      )}
    </div>
  );
}
