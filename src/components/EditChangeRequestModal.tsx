import { useState, useEffect } from 'react';
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
import { ChangeRequest } from '@/types/project';
import { AlertTriangle, RefreshCw, Pencil, Trash2 } from 'lucide-react';

interface EditChangeRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ChangeRequest | null;
  onSave: (request: ChangeRequest) => void;
  onDelete?: (id: string) => void;
}

export function EditChangeRequestModal({ 
  open, 
  onOpenChange, 
  request,
  onSave,
  onDelete,
}: EditChangeRequestModalProps) {
  const [type, setType] = useState<'site_issue' | 'substitution' | 'client_request'>('site_issue');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [costImpact, setCostImpact] = useState('0');
  const [timeImpact, setTimeImpact] = useState('0');
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  useEffect(() => {
    if (request) {
      setType(request.type);
      setTitle(request.title);
      setDescription(request.description);
      setReason(request.reason || '');
      setCostImpact(request.costImpact.toString());
      setTimeImpact(request.timeImpact.toString());
      setImageUrl(request.imageUrl);
    }
  }, [request]);

  const resetForm = () => {
    setType('site_issue');
    setTitle('');
    setDescription('');
    setReason('');
    setCostImpact('0');
    setTimeImpact('0');
    setImageUrl(undefined);
  };

  const handleSave = () => {
    if (request && title.trim() && description.trim()) {
      onSave({
        ...request,
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

  const handleDelete = () => {
    if (request && onDelete) {
      onDelete(request.id);
      resetForm();
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit Change Request</DialogTitle>
          <DialogDescription>
            Update the details of this change request.
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

          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              placeholder="e.g., Stormwater pipe discovered"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              placeholder="Explain what was found or needs to change..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reason">Reason (optional)</Label>
            <Input
              id="edit-reason"
              placeholder="e.g., Unforeseen site condition"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-costImpact">Cost Impact ($)</Label>
              <Input
                id="edit-costImpact"
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
              <Label htmlFor="edit-timeImpact">Time Impact (days)</Label>
              <Input
                id="edit-timeImpact"
                type="number"
                placeholder="0"
                value={timeImpact}
                onChange={(e) => setTimeImpact(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Photo Evidence</Label>
            <ImageUpload value={imageUrl} onChange={setImageUrl} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onDelete && (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="sm:mr-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!title.trim() || !description.trim()}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
