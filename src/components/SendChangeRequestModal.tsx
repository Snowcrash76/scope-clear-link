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
import { ChangeRequest, ScopeItem } from '@/types/project';
import { AlertTriangle, RefreshCw, MessageSquarePlus, Package } from 'lucide-react';

interface SendChangeRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (request: Omit<ChangeRequest, 'id' | 'status' | 'createdAt' | 'resolvedAt'>) => void;
  scopeItems?: ScopeItem[];
}

export function SendChangeRequestModal({ 
  open, 
  onOpenChange, 
  onSend,
  scopeItems = []
}: SendChangeRequestModalProps) {
  const [type, setType] = useState<'site_issue' | 'substitution'>('site_issue');
  const [selectedScopeItem, setSelectedScopeItem] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [costImpact, setCostImpact] = useState('0');
  const [timeImpact, setTimeImpact] = useState('0');
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  const resetForm = () => {
    setType('site_issue');
    setSelectedScopeItem('');
    setTitle('');
    setDescription('');
    setReason('');
    setCostImpact('0');
    setTimeImpact('0');
    setImageUrl(undefined);
  };

  const handleSend = () => {
    if (title.trim() && description.trim()) {
      onSend({
        type,
        title: title.trim(),
        description: description.trim(),
        reason: reason.trim() || undefined,
        costImpact: parseFloat(costImpact) || 0,
        timeImpact: parseInt(timeImpact) || 0,
        imageUrl,
      });
      resetForm();
      onOpenChange(false);
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
          <DialogTitle className="font-heading">Send Variation</DialogTitle>
          <DialogDescription>
            Notify the client about a required variation or substitution for approval.
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
              </SelectContent>
          </Select>
          </div>

          {scopeItems.length > 0 && (
            <div className="space-y-2">
              <Label>Related Scope of Works Item (optional)</Label>
              <Select value={selectedScopeItem} onValueChange={setSelectedScopeItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a scope item..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {scopeItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate max-w-[250px]">{item.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Stormwater pipe discovered"
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
            disabled={!title.trim() || !description.trim()}
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Send to Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
