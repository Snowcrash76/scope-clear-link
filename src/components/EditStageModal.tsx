import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EditStageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage?: { id: string; name: string; description: string; invoiceAmount?: number; invoicePercentage?: number };
  onSave: (data: { name: string; description: string; invoiceAmount?: number; invoicePercentage?: number }) => void;
  onDelete?: () => void;
}

export function EditStageModal({
  open,
  onOpenChange,
  stage,
  onSave,
  onDelete,
}: EditStageModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [billingType, setBillingType] = useState<'none' | 'amount' | 'percentage'>('none');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoicePercentage, setInvoicePercentage] = useState('');

  useEffect(() => {
    if (stage) {
      setName(stage.name);
      setDescription(stage.description);
      if (stage.invoiceAmount) {
        setBillingType('amount');
        setInvoiceAmount(stage.invoiceAmount.toString());
        setInvoicePercentage('');
      } else if (stage.invoicePercentage) {
        setBillingType('percentage');
        setInvoicePercentage(stage.invoicePercentage.toString());
        setInvoiceAmount('');
      } else {
        setBillingType('none');
        setInvoiceAmount('');
        setInvoicePercentage('');
      }
    } else {
      setName('');
      setDescription('');
      setBillingType('none');
      setInvoiceAmount('');
      setInvoicePercentage('');
    }
  }, [stage, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ 
      name: name.trim(), 
      description: description.trim(),
      invoiceAmount: billingType === 'amount' && invoiceAmount ? parseFloat(invoiceAmount) : undefined,
      invoicePercentage: billingType === 'percentage' && invoicePercentage ? parseFloat(invoicePercentage) : undefined,
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{stage ? 'Edit Stage' : 'Add Stage'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Stage Name</Label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Foundation Work"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-description">Description (optional)</Label>
            <Textarea
              id="stage-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this stage..."
              rows={3}
            />
          </div>

          {/* Billing Configuration */}
          <div className="space-y-2">
            <Label>Stage Billing (optional)</Label>
            <Select value={billingType} onValueChange={(v) => setBillingType(v as 'none' | 'amount' | 'percentage')}>
              <SelectTrigger>
                <SelectValue placeholder="No billing for this stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No billing</SelectItem>
                <SelectItem value="amount">Fixed amount</SelectItem>
                <SelectItem value="percentage">Percentage of quote</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Set billing to generate an invoice when this stage is completed
            </p>
          </div>

          {billingType === 'amount' && (
            <div className="space-y-2">
              <Label htmlFor="invoice-amount">Invoice Amount ($)</Label>
              <Input
                id="invoice-amount"
                type="number"
                min="0"
                step="0.01"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                placeholder="e.g., 5000"
              />
            </div>
          )}

          {billingType === 'percentage' && (
            <div className="space-y-2">
              <Label htmlFor="invoice-percentage">Percentage of Quote (%)</Label>
              <Input
                id="invoice-percentage"
                type="number"
                min="1"
                max="100"
                step="1"
                value={invoicePercentage}
                onChange={(e) => setInvoicePercentage(e.target.value)}
                placeholder="e.g., 30"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {stage && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="sm:mr-auto"
            >
              Delete Stage
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {stage ? 'Save Changes' : 'Add Stage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
