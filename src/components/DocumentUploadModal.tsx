import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendDocumentUploadNotification } from '@/lib/documentNotification';
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
import { 
  FileText, 
  Upload, 
  Loader2,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileWithDisplayName {
  file: File;
  displayName: string;
}

interface DocumentUploadModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}

export function DocumentUploadModal({ 
  projectId, 
  open, 
  onOpenChange, 
  onUploadComplete 
}: DocumentUploadModalProps) {
  const [files, setFiles] = useState<FileWithDisplayName[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: FileWithDisplayName[] = Array.from(selectedFiles).map(file => ({
      file,
      displayName: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for display name
    }));

    setFiles(prev => [...prev, ...newFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDisplayNameChange = (index: number, newName: string) => {
    setFiles(prev => prev.map((item, i) => 
      i === index ? { ...item, displayName: newName } : item
    ));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      for (const { file, displayName } of files) {
        // Upload file to storage
        const fileName = `${projectId}/${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Store in database with display name
        const { error: dbError } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            file_name: file.name,
            display_name: displayName.trim() || null,
            file_url: fileName,
            file_type: file.type || null,
            file_size: file.size,
          });

        if (dbError) throw dbError;
      }

      const uploadedNames = files.map(({ file, displayName }) =>
        displayName.trim() || file.name.replace(/\.[^/.]+$/, '')
      );
      toast.success(`${files.length} document${files.length > 1 ? 's' : ''} uploaded`);
      setFiles([]);
      onOpenChange(false);
      onUploadComplete();
      sendDocumentUploadNotification(projectId, uploadedNames);
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      onOpenChange(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return ImageIcon;
    if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return FileSpreadsheet;
    if (fileType.includes('pdf')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Add files and set display names for your client to see
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg,.dxf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Files
            </Button>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {files.map((item, index) => {
                const FileIcon = getFileIcon(item.file.type);
                return (
                  <div 
                    key={index}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded flex items-center justify-center flex-shrink-0",
                        item.file.type?.includes('pdf') ? "bg-destructive/10 text-destructive" :
                        item.file.type?.startsWith('image/') ? "bg-primary/10 text-primary" :
                        "bg-muted text-muted-foreground"
                      )}>
                        <FileIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground truncate">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => handleRemoveFile(index)}
                        disabled={isUploading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div>
                      <Label htmlFor={`display-name-${index}`} className="text-xs text-muted-foreground">
                        Display Name (shown to client)
                      </Label>
                      <Input
                        id={`display-name-${index}`}
                        value={item.displayName}
                        onChange={(e) => handleDisplayNameChange(index, e.target.value)}
                        placeholder="e.g., Site Plans - July 2021"
                        className="mt-1"
                        disabled={isUploading}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {files.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No files selected. Click "Select Files" to add documents.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={files.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              `Upload ${files.length > 0 ? files.length : ''} File${files.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}