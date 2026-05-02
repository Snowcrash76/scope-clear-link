import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import { MultiImageUpload } from '@/components/MultiImageUpload';
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
import { ScopeItem } from '@/types/project';
import { Package, Ban, AlertTriangle } from 'lucide-react';

interface EditScopeItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ScopeItem;
  defaultCategory?: 'included' | 'excluded' | 'assumption';
  onSave: (item: Omit<ScopeItem, 'id' | 'acknowledged'> & { id?: string }) => void;
  onDelete?: (id: string) => void;
}

export function EditScopeItemModal({ 
  open, 
  onOpenChange, 
  item,
  defaultCategory,
  onSave,
  onDelete 
}: EditScopeItemModalProps) {
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [category, setCategory] = useState<'included' | 'excluded' | 'assumption'>(
    item?.category || defaultCategory || 'included'
  );
  const [imageUrls, setImageUrls] = useState<string[]>(
    item?.imageUrls || (item?.imageUrl ? [item.imageUrl] : [])
  );
  const [cost, setCost] = useState<string>(item?.cost?.toString() || '');

  const isEditing = !!item;

  const handleSave = () => {
    if (title.trim() && description.trim()) {
      onSave({
        id: item?.id,
        title: title.trim(),
        description: description.trim(),
        category,
        imageUrls,
        imageUrl: imageUrls[0], // Keep backwards compatibility
        cost: cost ? parseFloat(cost) : undefined,
      });
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (item && onDelete) {
      onDelete(item.id);
      onOpenChange(false);
    }
  };

  // Reset form when item changes or modal opens
  useEffect(() => {
    if (open) {
      setTitle(item?.title || '');
      setDescription(item?.description || '');
      setCategory(item?.category || defaultCategory || 'included');
      setImageUrls(item?.imageUrls || (item?.imageUrl ? [item.imageUrl] : []));
      setCost(item?.cost?.toString() || '');
    }
  }, [open, item, defaultCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? 'Edit Item' : 'Add Item'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the item details.'
              : 'Add a new item to the quote.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="included">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-approved" />
                    Included
                  </div>
                </SelectItem>
                <SelectItem value="excluded">
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-destructive" />
                    Excluded
                  </div>
                </SelectItem>
                <SelectItem value="assumption">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-pending-foreground" />
                    Assumption
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Treated pine retaining wall"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Detailed description of what this includes..."
              minHeight="100px"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Quote Amount (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="cost"
                type="number"
                placeholder="0.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="pl-7"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Photos (optional)</Label>
            <MultiImageUpload 
              value={imageUrls} 
              onChange={setImageUrls}
              maxImages={10}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEditing && onDelete && (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="sm:mr-auto"
            >
              Delete Item
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!title.trim() || !description.trim()}
          >
            {isEditing ? 'Save Changes' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}