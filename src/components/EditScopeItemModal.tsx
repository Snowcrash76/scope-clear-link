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
import { ScopeItem } from '@/types/project';
import { Package, Ban, AlertTriangle } from 'lucide-react';

interface EditScopeItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ScopeItem;
  onSave: (item: Omit<ScopeItem, 'id' | 'acknowledged'> & { id?: string }) => void;
  onDelete?: (id: string) => void;
}

export function EditScopeItemModal({ 
  open, 
  onOpenChange, 
  item, 
  onSave,
  onDelete 
}: EditScopeItemModalProps) {
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [category, setCategory] = useState<'included' | 'excluded' | 'assumption'>(
    item?.category || 'included'
  );
  const [imageUrl, setImageUrl] = useState<string | undefined>(item?.imageUrl);

  const isEditing = !!item;

  const handleSave = () => {
    if (title.trim() && description.trim()) {
      onSave({
        id: item?.id,
        title: title.trim(),
        description: description.trim(),
        category,
        imageUrl,
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

  // Reset form when item changes
  useState(() => {
    setTitle(item?.title || '');
    setDescription(item?.description || '');
    setCategory(item?.category || 'included');
    setImageUrl(item?.imageUrl);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? 'Edit Scope Item' : 'Add Scope Item'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the scope item details.'
              : 'Add a new item to the project scope.'
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Detailed description of what this includes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Photo (optional)</Label>
            <ImageUpload value={imageUrl} onChange={setImageUrl} />
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
