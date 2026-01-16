import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ImageUpload';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Package, Ban, AlertTriangle, DollarSign, CalendarIcon, FileText, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';

interface QuoteLineItem {
  tempId: string;
  title: string;
  description: string;
  cost: number;
  category: 'included' | 'excluded' | 'assumption';
  imageUrl?: string;
}

interface CreateJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTerms?: string;
  onCreateJob: (job: {
    name: string;
    clientName: string;
    clientEmail: string;
    quoteData: {
      lineItems: Omit<QuoteLineItem, 'tempId'>[];
      taxRate: number;
      validUntil: Date | null;
      notes: string;
      terms: string;
    };
  }) => void;
}

const DEFAULT_TERMS = 'Payment terms: 50% deposit required to commence work. Balance due on completion.';

export function CreateJobModal({ open, onOpenChange, onCreateJob, defaultTerms }: CreateJobModalProps) {
  const [step, setStep] = useState(1);
  
  // Step 1: Job Details
  const [jobName, setJobName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  
  // Step 2: Quote Builder
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [currentItem, setCurrentItem] = useState<QuoteLineItem>({
    tempId: '',
    title: '',
    description: '',
    cost: 0,
    category: 'included',
    imageUrl: undefined,
  });
  const [taxRate, setTaxRate] = useState(10); // Default 10% GST
  const [validUntil, setValidUntil] = useState<Date | undefined>(addDays(new Date(), 30));
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(defaultTerms || DEFAULT_TERMS);

  const resetForm = () => {
    setStep(1);
    setJobName('');
    setClientName('');
    setClientEmail('');
    setLineItems([]);
    setCurrentItem({
      tempId: '',
      title: '',
      description: '',
      cost: 0,
      category: 'included',
      imageUrl: undefined,
    });
    setTaxRate(10);
    setValidUntil(addDays(new Date(), 30));
    setNotes('');
    setTerms(defaultTerms || DEFAULT_TERMS);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleAddLineItem = () => {
    if (currentItem.title.trim()) {
      setLineItems(prev => [...prev, { ...currentItem, tempId: `temp_${Date.now()}` }]);
      setCurrentItem({
        tempId: '',
        title: '',
        description: '',
        cost: 0,
        category: 'included',
        imageUrl: undefined,
      });
    }
  };

  const handleRemoveLineItem = (tempId: string) => {
    setLineItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const handleSubmit = () => {
    onCreateJob({
      name: jobName,
      clientName,
      clientEmail,
      quoteData: {
        lineItems: lineItems.map(({ tempId, ...item }) => item),
        taxRate,
        validUntil: validUntil || null,
        notes,
        terms,
      },
    });
    handleClose();
  };

  const canProceedStep1 = jobName.trim() && clientName.trim() && clientEmail.trim();
  const hasIncludedItems = lineItems.some(item => item.category === 'included');
  const canSubmit = hasIncludedItems;

  const subtotal = lineItems
    .filter(item => item.category === 'included')
    .reduce((sum, item) => sum + (item.cost || 0), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const categoryOptions: { value: 'included' | 'excluded' | 'assumption'; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'included', label: 'Included', icon: Package, color: 'text-approved' },
    { value: 'excluded', label: 'Excluded', icon: Ban, color: 'text-destructive' },
    { value: 'assumption', label: 'Assumption', icon: AlertTriangle, color: 'text-pending-foreground' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            {step === 1 ? (
              'Create New Job'
            ) : (
              <>
                <FileText className="w-5 h-5 text-primary" />
                Build Your Quote
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'Enter the job and client details to get started.'
              : 'Add line items to build your quote. Included items will become your scope of work.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="jobName">Job Name</Label>
              <Input
                id="jobName"
                placeholder="e.g., Smith Backyard Landscaping"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                placeholder="e.g., Sarah Smith"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client Email</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="e.g., sarah@email.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Existing line items */}
            {lineItems.length > 0 && (
              <div className="space-y-2">
                <Label>Quote Items ({lineItems.length})</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {lineItems.map((item) => {
                    const config = categoryOptions.find(c => c.value === item.category)!;
                    const Icon = config.icon;
                    return (
                      <div 
                        key={item.tempId}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                      >
                        <Icon className={cn("w-4 h-4 flex-shrink-0", config.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{item.title}</p>
                            {item.category === 'included' && item.cost > 0 && (
                              <span className="text-xs font-medium text-primary">
                                ${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveLineItem(item.tempId)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quote Summary */}
            {subtotal > 0 && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST ({taxRate}%)</span>
                  <span className="font-medium">${taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-primary/20">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary text-lg">
                    ${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Add new line item */}
            <div className="space-y-3 p-4 rounded-lg border border-dashed">
              <Label>Add Quote Item</Label>
              
              {/* Category selector */}
              <div className="flex gap-2">
                {categoryOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setCurrentItem(prev => ({ ...prev, category: option.value }))}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                        currentItem.category === option.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-secondary/80"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <Input
                placeholder="Item title (e.g., Install new patio pavers)"
                value={currentItem.title}
                onChange={(e) => setCurrentItem(prev => ({ ...prev, title: e.target.value }))}
              />
              
              <Textarea
                placeholder="Description (optional)"
                value={currentItem.description}
                onChange={(e) => setCurrentItem(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[60px]"
              />

              {/* Cost field for included items */}
              {currentItem.category === 'included' && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Cost (AUD)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={currentItem.cost || ''}
                    onChange={(e) => setCurrentItem(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Photo (optional)</Label>
                <ImageUpload 
                  value={currentItem.imageUrl} 
                  onChange={(url) => setCurrentItem(prev => ({ ...prev, imageUrl: url }))} 
                />
              </div>

              <Button
                variant="outline"
                onClick={handleAddLineItem}
                disabled={!currentItem.title.trim()}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

            {/* Quote Settings */}
            <div className="space-y-4 p-4 rounded-lg bg-secondary/30">
              <h4 className="font-medium text-sm">Quote Settings</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5" />
                    Tax Rate (%)
                  </Label>
                  <Input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Valid Until
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !validUntil && "text-muted-foreground"
                        )}
                      >
                        {validUntil ? format(validUntil, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={validUntil}
                        onSelect={setValidUntil}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Notes for Client</Label>
                <Textarea
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Terms & Conditions</Label>
                <Textarea
                  placeholder="Payment terms, warranty, etc."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          {step === 1 ? (
            <Button 
              onClick={() => setStep(2)} 
              disabled={!canProceedStep1}
            >
              Next: Build Quote
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button 
                variant="accent"
                onClick={handleSubmit} 
                disabled={!canSubmit}
              >
                <FileText className="w-4 h-4 mr-2" />
                Create Job & Quote
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
