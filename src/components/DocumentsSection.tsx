import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Download, 
  Loader2,
  File,
  Image as ImageIcon,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProjectDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface DocumentsSectionProps {
  projectId: string;
  documents: ProjectDocument[];
  onRefresh: () => void;
}

export function DocumentsSection({ projectId, documents, onRefresh }: DocumentsSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Upload file to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${projectId}/${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('project-documents')
          .getPublicUrl(fileName);

        // Save document record
        const { error: dbError } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type || null,
            file_size: file.size,
          });

        if (dbError) throw dbError;
      }

      toast.success(`${files.length} document${files.length > 1 ? 's' : ''} uploaded`);
      onRefresh();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (doc: ProjectDocument) => {
    setDeletingId(doc.id);

    try {
      // Extract file path from URL
      const urlParts = doc.file_url.split('/project-documents/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('project-documents').remove([filePath]);
      }

      // Delete database record
      const { error } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast.success('Document deleted');
      onRefresh();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return File;
    if (fileType.startsWith('image/')) return ImageIcon;
    if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return FileSpreadsheet;
    if (fileType.includes('pdf')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Documents</h2>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg,.dxf"
            onChange={handleUpload}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {documents.length > 0 ? (
        <Card className="divide-y">
          {documents.map((doc) => {
            const FileIcon = getFileIcon(doc.file_type);
            return (
              <div 
                key={doc.id}
                className="p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  doc.file_type?.includes('pdf') ? "bg-destructive/10 text-destructive" :
                  doc.file_type?.startsWith('image/') ? "bg-primary/10 text-primary" :
                  "bg-muted text-muted-foreground"
                )}>
                  <FileIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                    {doc.file_size && ' • '}
                    {format(new Date(doc.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                  >
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" download>
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No documents uploaded yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Upload plans, specifications, contracts, and other project files
          </p>
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload First Document
          </Button>
        </Card>
      )}
    </div>
  );
}