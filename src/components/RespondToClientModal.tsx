import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImageUpload } from '@/components/ImageUpload';
import { ChangeRequest } from '@/types/project';
import { DollarSign, Clock, Send } from 'lucide-react';

interface RespondToClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ChangeRequest | null;
  onSubmit: (data: {
    title: string;
    description: string;
    costImpact: number;
    timeImpact: number;
    reason?: string;
    imageUrl?: string;
  }) => Promise<void>;
}

export function RespondToClientModal({ 
  isOpen, 
  onClose, 
  request,
  onSubmit 
}: RespondToClientModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [costImpact, setCostImpact] = useState('0');
  const [timeImpact, setTimeImpact] = useState('0');
  const [reason, setReason] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when request changes
  useEffect(() => {
    if (request) {
      setTitle(request.title || 'Change request');
      setDescription(request.description || '');
      setCostImpact(request.costImpact?.toString() || '0');
      setTimeImpact(request.timeImpact?.toString() || '0');
      setReason('');
      setImageUrl(request.imageUrl || undefined);
    }
  }, [request]);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        costImpact: parseFloat(costImpact) || 0,
        timeImpact: parseInt(timeImpact) || 0,
        reason: reason.trim() || undefined,
        imageUrl: imageUrl || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error responding to client:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Respond to Client Request</DialogTitle>
          <DialogDescription>
            Review and add cost/time impacts before sending back to the client for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Original request info */}
          <div className="p-3 rounded-lg bg-secondary/50 text-sm">
            <p className="text-muted-foreground">Original request from client:</p>
            <p className="font-medium mt-1">{request.description}</p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Change request title"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this change involves..."
              rows={3}
            />
          </div>

          {/* Cost & Time Impact */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costImpact" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                Cost Impact
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="costImpact"
                  type="number"
                  value={costImpact}
                  onChange={(e) => setCostImpact(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use negative for credits
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeImpact" className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Time Impact (days)
              </Label>
              <Input
                id="timeImpact"
                type="number"
                value={timeImpact}
                onChange={(e) => setTimeImpact(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Reason/Notes */}
          <div className="space-y-2">
            <Label htmlFor="reason">Your Notes (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add any notes or explanation for the client..."
              rows={2}
            />
          </div>

          {/* Image */}
          <div className="space-y-2">
            <Label>Photo Evidence (optional)</Label>
            <ImageUpload 
              value={imageUrl} 
              onChange={setImageUrl}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Sending...' : 'Send to Client'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
