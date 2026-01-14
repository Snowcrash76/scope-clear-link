import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ImageUpload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Package, Ban, AlertTriangle, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScopeItem } from '@/types/project';

interface CreateJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateJob: (job: {
    name: string;
    clientName: string;
    clientEmail: string;
    scopeItems: Omit<ScopeItem, 'id' | 'acknowledged'>[];
  }) => void;
}

type ScopeCategory = 'included' | 'excluded' | 'assumption';

interface ScopeItemDraft {
  tempId: string;
  title: string;
  description: string;
  category: ScopeCategory;
  cost: number;
  imageUrl?: string;
}

export function CreateJobModal({ open, onOpenChange, onCreateJob }: CreateJobModalProps) {
  const [step, setStep] = useState(1);
  const [jobName, setJobName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [scopeItems, setScopeItems] = useState<ScopeItemDraft[]>([]);
  const [currentItem, setCurrentItem] = useState<ScopeItemDraft>({
    tempId: '',
    title: '',
    description: '',
    category: 'included',
    cost: 0,
    imageUrl: undefined,
  });

  const resetForm = () => {
    setStep(1);
    setJobName('');
    setClientName('');
    setClientEmail('');
    setScopeItems([]);
    setCurrentItem({
      tempId: '',
      title: '',
      description: '',
      category: 'included',
      cost: 0,
      imageUrl: undefined,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleAddScopeItem = () => {
    if (currentItem.title.trim() && currentItem.description.trim()) {
      setScopeItems(prev => [...prev, { ...currentItem, tempId: `temp_${Date.now()}` }]);
      setCurrentItem({
        tempId: '',
        title: '',
        description: '',
        category: 'included',
        cost: 0,
        imageUrl: undefined,
      });
    }
  };

  const handleRemoveScopeItem = (tempId: string) => {
    setScopeItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const handleSubmit = () => {
    onCreateJob({
      name: jobName,
      clientName,
      clientEmail,
      scopeItems: scopeItems.map(({ tempId, ...item }) => item),
    });
    handleClose();
  };

  const canProceedStep1 = jobName.trim() && clientName.trim() && clientEmail.trim();
  const canSubmit = scopeItems.length > 0;

  const categoryOptions: { value: ScopeCategory; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'included', label: 'Included', icon: Package, color: 'text-approved' },
    { value: 'excluded', label: 'Excluded', icon: Ban, color: 'text-destructive' },
    { value: 'assumption', label: 'Assumption', icon: AlertTriangle, color: 'text-pending-foreground' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {step === 1 ? 'Create New Job' : 'Add Scope Items'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'Enter the job and client details to get started.'
              : 'Define what\'s included, excluded, and your assumptions.'
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
            {/* Existing scope items */}
            {scopeItems.length > 0 && (
              <div className="space-y-2">
                <Label>Added Items ({scopeItems.length})</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {scopeItems.map((item) => {
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
                            {item.cost > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveScopeItem(item.tempId)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                {/* Quote Total Summary */}
                {(() => {
                  const total = scopeItems
                    .filter(item => item.category === 'included')
                    .reduce((sum, item) => sum + (item.cost || 0), 0);
                  if (total > 0) {
                    return (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Quote Total</span>
                        </div>
                        <span className="font-bold text-primary">
                          ${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Add new item */}
            <div className="space-y-3 p-4 rounded-lg border border-dashed">
              <Label>Add Scope Item</Label>
              
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
                placeholder="Item title"
                value={currentItem.title}
                onChange={(e) => setCurrentItem(prev => ({ ...prev, title: e.target.value }))}
              />
              
              <Textarea
                placeholder="Detailed description..."
                value={currentItem.description}
                onChange={(e) => setCurrentItem(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[80px]"
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
                onClick={handleAddScopeItem}
                disabled={!currentItem.title.trim() || !currentItem.description.trim()}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
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
              Next: Add Scope
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
                Create Job
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
