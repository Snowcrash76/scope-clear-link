import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectDocument {
  id: string;
  file_name: string;
  display_name: string | null;
}

interface EditDocumentModalProps {
  document: ProjectDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EditDocumentModal({ 
  document, 
  open, 
  onOpenChange, 
  onSave 
}: EditDocumentModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (document) {
      setDisplayName(document.display_name || '');
    }
  }, [document]);

  const handleSave = async () => {
    if (!document) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('project_documents')
        .update({ display_name: displayName.trim() || null })
        .eq('id', document.id);

      if (error) throw error;

      toast.success('Document name updated');
      onOpenChange(false);
      onSave();
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Failed to update document name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Document Name</DialogTitle>
          <DialogDescription>
            Set a display name that your client will see
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Original filename</Label>
            <p className="text-sm font-medium mt-1">{document?.file_name}</p>
          </div>
          
          <div>
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Site Plans - July 2021"
              className="mt-1"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to show the original filename
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}