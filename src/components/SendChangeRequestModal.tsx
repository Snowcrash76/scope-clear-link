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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChangeRequest, ScopeItem, QuoteLineItem } from '@/types/project';
import { AlertTriangle, RefreshCw, MessageSquarePlus } from 'lucide-react';
import { AdditionSetupHelp } from '@/components/AdditionSetupHelp';
import { VariationQuoteItemSelect } from '@/components/VariationQuoteItemSelect';
import { variationItemLinks } from '@/lib/variationItems';

interface SendChangeRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (request: Omit<ChangeRequest, 'id' | 'status' | 'createdAt' | 'resolvedAt'>) => Promise<boolean>;
  scopeItems?: ScopeItem[];
  quoteItems?: QuoteLineItem[];
}

export function SendChangeRequestModal({ 
  open, 
  onOpenChange, 
  onSend,
  scopeItems = [],
  quoteItems = [],
}: SendChangeRequestModalProps) {
  const [type, setType] = useState<'site_issue' | 'substitution' | 'addition'>('site_issue');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [selectedScopeItem, setSelectedScopeItem] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [costImpact, setCostImpact] = useState('0');
  const [timeImpact, setTimeImpact] = useState('0');
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  const resetForm = () => {
    setSaveFailed(false);
    setType('site_issue');
    setSelectedScopeItem('');
    setTitle('');
    setDescription('');
    setReason('');
    setCostImpact('0');
    setTimeImpact('0');
    setImageUrl(undefined);
  };

  const handleSend = async () => {
    if (title.trim() && description.trim()) {
      setSaving(true);
      setSaveFailed(false);
      try {
        const success = await onSend({
          type,
          ...variationItemLinks(selectedScopeItem),
          title: title.trim(),
          description: description.trim(),
          reason: reason.trim() || undefined,
          costImpact: parseFloat(costImpact) || 0,
          timeImpact: parseInt(timeImpact) || 0,
          imageUrl,
        });
        if (!success) { setSaveFailed(true); return; }
        resetForm();
        onOpenChange(false);
      } catch {
        setSaveFailed(true);
      } finally { setSaving(false); }
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Add Variation</DialogTitle>
          <DialogDescription>
            Notify the client about a variation for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="site_issue">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    Site Issue
                  </div>
                </SelectItem>
                <SelectItem value="substitution">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    Substitution
                  </div>
                </SelectItem>
                <SelectItem value="addition">Addition — extra materials or work</SelectItem>
              </SelectContent>
          </Select>
          </div>

          {type === 'addition' && <p className="text-sm text-muted-foreground">Add extra materials or work to an existing quote item. Enter only the additional cost, not the original item price.</p>}
          {saveFailed && (type === 'addition' || (selectedScopeItem && selectedScopeItem !== 'none')) ? <AdditionSetupHelp saveFailed /> : type === 'addition' && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">One-time Addition database setup</summary>
              <AdditionSetupHelp />
            </details>
          )}

          <VariationQuoteItemSelect value={selectedScopeItem} onChange={setSelectedScopeItem} scopeItems={scopeItems} quoteItems={quoteItems} />

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder={type === 'addition' ? 'e.g., Extra timber for decking' : 'e.g., Stormwater pipe discovered'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Explain what was found or needs to change..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              placeholder="e.g., Unforeseen site condition"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costImpact">Cost Impact ($)</Label>
              <Input
                id="costImpact"
                type="number"
                placeholder="0"
                value={costImpact}
                onChange={(e) => setCostImpact(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Positive = additional cost, Negative = savings
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeImpact">Time Impact (days)</Label>
              <Input
                id="timeImpact"
                type="number"
                min="0"
                placeholder="0"
                value={timeImpact}
                onChange={(e) => setTimeImpact(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Photo Evidence (recommended)</Label>
            <ImageUpload value={imageUrl} onChange={setImageUrl} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant="accent"
            onClick={handleSend}
            disabled={saving || !title.trim() || !description.trim()}
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Send to Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
