import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  FileText, 
  Download, 
  Loader2,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProjectDocument {
  id: string;
  file_name: string;
  display_name: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface ClientDocumentsSectionProps {
  documents: ProjectDocument[];
}

export function ClientDocumentsSection({ documents }: ClientDocumentsSectionProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  const handleDownload = async (doc: ProjectDocument) => {
    setDownloadingId(doc.id);
    try {
      let filePath = doc.file_url;
      
      if (filePath.includes('/project-documents/')) {
        filePath = filePath.split('/project-documents/')[1];
        if (filePath.includes('?')) {
          filePath = filePath.split('?')[0];
        }
      }
      
      const { data, error } = await supabase.storage
        .from('project-documents')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleView = async (doc: ProjectDocument) => {
    try {
      let filePath = doc.file_url;
      
      if (filePath.includes('/project-documents/')) {
        filePath = filePath.split('/project-documents/')[1];
        if (filePath.includes('?')) {
          filePath = filePath.split('?')[0];
        }
      }
      
      const { data, error } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(filePath, 300);

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Failed to view document');
    }
  };

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-bold">Documents</h2>
        <p className="text-sm text-muted-foreground">
          Plans, specifications, and project files shared by your trade
        </p>
      </div>

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
                <p className="font-medium truncate">{doc.display_name || doc.file_name}</p>
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
                  onClick={() => handleView(doc)}
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  title="Download"
                >
                  {downloadingId === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
