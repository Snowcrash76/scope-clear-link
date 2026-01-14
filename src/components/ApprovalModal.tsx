import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, X } from 'lucide-react';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  action: 'approve' | 'decline';
  title: string;
}

export function ApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  title,
}: ApprovalModalProps) {
  const [comment, setComment] = useState('');

  const handleConfirm = () => {
    onConfirm(comment);
    setComment('');
  };

  const handleClose = () => {
    setComment('');
    onClose();
  };

  const isApprove = action === 'approve';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <Check className="w-5 h-5 text-approved" />
            ) : (
              <X className="w-5 h-5 text-declined" />
            )}
            {isApprove ? 'Approve' : 'Decline'} Change
          </DialogTitle>
          <DialogDescription>
            {isApprove 
              ? `You are approving "${title}".`
              : `You are declining "${title}".`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Label htmlFor="comment">
            Add a comment {isApprove ? '(optional)' : '(recommended)'}
          </Label>
          <Textarea
            id="comment"
            placeholder={
              isApprove
                ? 'Any notes about this approval...'
                : 'Please explain why you are declining this change...'
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? 'approve' : 'decline'}
            onClick={handleConfirm}
          >
            {isApprove ? (
              <>
                <Check className="w-4 h-4" />
                Confirm Approval
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                Confirm Decline
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
