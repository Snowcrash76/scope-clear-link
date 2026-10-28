import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendClientDocumentUploadNotification } from '@/lib/documentNotification';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  FileText, 
  Download, 
  Loader2,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  Eye,
  Upload,
  CloudUpload,
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
  projectId: string;
  onRefresh: () => void;
}

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function ClientDocumentsSection({ documents, projectId, onRefresh }: ClientDocumentsSectionProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB} MB limit`);
      return;
    }

    // Step 1: get a signed upload URL from the server
    const tokenRes = await fetch('/api/get-signed-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, fileName: file.name }),
    });
    if (!tokenRes.ok) {
      const { error } = await tokenRes.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error || 'Failed to get upload URL');
    }
    const { signedUrl: _signedUrl, token, path } = await tokenRes.json() as {
      signedUrl: string;
      token: string;
      path: string;
    };

    // Step 2: upload directly to Supabase Storage using the signed token
    const { error: uploadError } = await supabase.storage
      .from('project-documents')
      .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });

    if (uploadError) throw new Error(uploadError.message);

    // Step 3: record the document metadata in the database
    const recordRes = await fetch('/api/record-client-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        fileName: file.name,
        filePath: path,
        fileType: file.type || null,
        fileSize: file.size,
      }),
    });
    if (!recordRes.ok) {
      const { error } = await recordRes.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error || 'Failed to save document record');
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (const file of list) {
      try {
        await uploadFile(file);
        successCount++;
      } catch (err) {
        console.error('Upload error:', err);
        toast.error(`Failed to upload "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setUploading(false);
    if (successCount > 0) {
      const uploadedNames = list.slice(0, successCount).map(f => f.name.replace(/\.[^/.]+$/, ''));
      toast.success(successCount === 1 ? 'Document uploaded' : `${successCount} documents uploaded`);
      onRefresh();
      sendClientDocumentUploadNotification(projectId, uploadedNames);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleDownload = async (doc: ProjectDocument) => {
    setDownloadingId(doc.id);
    try {
      let filePath = doc.file_url;
      if (filePath.includes('/project-documents/')) {
        filePath = filePath.split('/project-documents/')[1];
        if (filePath.includes('?')) filePath = filePath.split('?')[0];
      }
      const { data, error } = await supabase.storage.from('project-documents').download(filePath);
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
        if (filePath.includes('?')) filePath = filePath.split('?')[0];
      }
      const { data, error } = await supabase.storage.from('project-documents').createSignedUrl(filePath, 300);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Failed to view document');
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        data-testid="client-document-upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors select-none",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-secondary/30",
          uploading && "opacity-60 cursor-default"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
          data-testid="client-document-file-input"
        />
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </>
        ) : (
          <>
            <CloudUpload className="w-8 h-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Drop files here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Up to {MAX_FILE_SIZE_MB} MB per file</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="pointer-events-none"
              data-testid="client-document-upload-button"
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose Files
            </Button>
          </>
        )}
      </div>

      {/* Document list */}
      {documents.length > 0 && (
        <Card className="divide-y">
          {documents.map((doc) => {
            const FileIcon = getFileIcon(doc.file_type);
            return (
              <div
                key={doc.id}
                data-testid={`client-document-row-${doc.id}`}
                className="p-3 sm:p-4 flex min-w-0 flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 hover:bg-secondary/30 transition-colors"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  doc.file_type?.includes('pdf') ? "bg-destructive/10 text-destructive" :
                  doc.file_type?.startsWith('image/') ? "bg-primary/10 text-primary" :
                  "bg-muted text-muted-foreground"
                )}>
                  <FileIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-0">
                  <p className="break-words [overflow-wrap:anywhere] font-medium">{doc.display_name || doc.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                    {doc.file_size && ' • '}
                    {format(new Date(doc.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleView(doc)}
                    title="View"
                    data-testid={`button-view-doc-${doc.id}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                    title="Download"
                    data-testid={`button-download-doc-${doc.id}`}
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
      )}
    </div>
  );
}
