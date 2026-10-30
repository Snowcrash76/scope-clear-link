import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Loader2,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  Eye,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DocumentUploadModal } from "./DocumentUploadModal";
import { EditDocumentModal } from "./EditDocumentModal";
import { portalRequest } from "@/hooks/useEmployeePortal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ProjectDocument {
  id: string;
  file_name: string;
  display_name: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  employee_visible?: boolean;
}

interface DocumentsSectionProps {
  projectId: string;
  documents: ProjectDocument[];
  onRefresh: () => void;
}

export function DocumentsSection({
  projectId,
  documents,
  onRefresh,
}: DocumentsSectionProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] =
    useState<ProjectDocument | null>(null);
  const [visibilitySaving, setVisibilitySaving] = useState<string | null>(null);
  const [visibilityTarget, setVisibilityTarget] =
    useState<ProjectDocument | null>(null);

  const toggleEmployeeVisibility = async (
    doc: ProjectDocument,
    visible: boolean,
  ) => {
    if (visible) {
      setVisibilityTarget(doc);
      return;
    }
    await saveEmployeeVisibility(doc, false);
  };

  const saveEmployeeVisibility = async (
    doc: ProjectDocument,
    visible: boolean,
  ) => {
    setVisibilitySaving(doc.id);
    try {
      await portalRequest(`/team/documents/${doc.id}/visibility`, {
        employee_visible: visible,
      });
      toast.success(
        visible ? "Published to employees" : "Employee access removed",
      );
      onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update employee visibility",
      );
    } finally {
      setVisibilitySaving(null);
    }
  };

  const handleDelete = async (doc: ProjectDocument) => {
    setDeletingId(doc.id);

    try {
      // Clean the file path - remove any URL parts if present
      let filePath = doc.file_url;

      // If it's a full URL, extract just the path
      if (filePath.includes("/project-documents/")) {
        filePath = filePath.split("/project-documents/")[1];
        // Remove any query parameters
        if (filePath.includes("?")) {
          filePath = filePath.split("?")[0];
        }
      }

      // Delete from storage
      await supabase.storage.from("project-documents").remove([filePath]);

      // Delete database record
      const { error } = await supabase
        .from("project_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast.success("Document deleted");
      onRefresh();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return File;
    if (fileType.startsWith("image/")) return ImageIcon;
    if (
      fileType.includes("spreadsheet") ||
      fileType.includes("excel") ||
      fileType.includes("csv")
    )
      return FileSpreadsheet;
    if (fileType.includes("pdf")) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (doc: ProjectDocument) => {
    try {
      // Clean the file path - remove any URL parts if present
      let filePath = doc.file_url;

      // If it's a full URL, extract just the path
      if (filePath.includes("/project-documents/")) {
        filePath = filePath.split("/project-documents/")[1];
        // Remove any query parameters
        if (filePath.includes("?")) {
          filePath = filePath.split("?")[0];
        }
      }

      // Use Supabase download method to get the file as blob
      const { data, error } = await supabase.storage
        .from("project-documents")
        .download(filePath);

      if (error) throw error;

      // Create a blob URL and trigger download
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Download started");
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Failed to download document");
    }
  };

  const handleView = async (doc: ProjectDocument) => {
    try {
      // Clean the file path - remove any URL parts if present
      let filePath = doc.file_url;

      // If it's a full URL, extract just the path
      if (filePath.includes("/project-documents/")) {
        filePath = filePath.split("/project-documents/")[1];
        // Remove any query parameters
        if (filePath.includes("?")) {
          filePath = filePath.split("?")[0];
        }
      }

      console.log("Viewing document with path:", filePath);

      // Get signed URL for viewing
      const { data, error } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(filePath, 300); // 5 minutes validity

      if (error) {
        console.error("Signed URL error:", error);
        throw error;
      }

      // Open in new tab
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error("Failed to view document");
    }
  };

  const displayName = (doc: ProjectDocument) =>
    doc.display_name || doc.file_name;

  return (
    <AlertDialog
      open={!!visibilityTarget}
      onOpenChange={(open) => !open && setVisibilityTarget(null)}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Documents</h2>
          <Button onClick={() => setUploadModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>

        {documents.length > 0 ? (
          <Card className="divide-y">
            {documents.map((doc) => {
              const FileIcon = getFileIcon(doc.file_type);
              const hasCustomName =
                doc.display_name && doc.display_name !== doc.file_name;
              return (
                <div
                  key={doc.id}
                  className="p-3 sm:p-4 flex min-w-0 flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 hover:bg-secondary/30 transition-colors"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      doc.file_type?.includes("pdf")
                        ? "bg-destructive/10 text-destructive"
                        : doc.file_type?.startsWith("image/")
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    <FileIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-0">
                    <p className="break-words [overflow-wrap:anywhere] font-medium">
                      {displayName(doc)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {hasCustomName && (
                        <span className="break-words [overflow-wrap:anywhere] text-xs">
                          {doc.file_name} •{" "}
                        </span>
                      )}
                      {formatFileSize(doc.file_size)}
                      {doc.file_size && " • "}
                      {format(new Date(doc.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">
                    <label className="mr-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted-foreground">
                      <input
                        aria-label={`Publish ${displayName(doc)} to employees`}
                        type="checkbox"
                        checked={!!doc.employee_visible}
                        disabled={visibilitySaving === doc.id}
                        onChange={(event) =>
                          void toggleEmployeeVisibility(
                            doc,
                            event.target.checked,
                          )
                        }
                      />
                      Staff access
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11"
                          onClick={() => setEditingDocument(doc)}
                          title={`Edit ${displayName(doc)} display name`}
                          aria-label={`Edit ${displayName(doc)} display name`}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Edit {displayName(doc)} display name
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11"
                          onClick={() => handleView(doc)}
                          title={`View ${displayName(doc)}`}
                          aria-label={`View ${displayName(doc)}`}
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View {displayName(doc)}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11"
                          onClick={() => handleDownload(doc)}
                          title={`Download ${displayName(doc)}`}
                          aria-label={`Download ${displayName(doc)}`}
                        >
                          <Download className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Download {displayName(doc)}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11"
                          onClick={() => handleDelete(doc)}
                          disabled={deletingId === doc.id}
                          title={`Delete ${displayName(doc)}`}
                          aria-label={`Delete ${displayName(doc)}`}
                        >
                          {deletingId === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Delete {displayName(doc)}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No documents uploaded yet
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Upload plans, specifications, contracts, and other project files
            </p>
            <Button variant="outline" onClick={() => setUploadModalOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload First Document
            </Button>
          </Card>
        )}

        <DocumentUploadModal
          projectId={projectId}
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          onUploadComplete={onRefresh}
        />

        <EditDocumentModal
          document={editingDocument}
          open={!!editingDocument}
          onOpenChange={(open) => !open && setEditingDocument(null)}
          onSave={onRefresh}
        />
      </div>
      <AlertDialogContent>
        <AlertDialogTitle>
          Publish this file to assigned employees?
        </AlertDialogTitle>
        <AlertDialogDescription>
          Assigned employees will be able to view this file. Check first that it
          contains no rates, prices, or other financial details.
        </AlertDialogDescription>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel className="min-h-11 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              if (visibilityTarget)
                void saveEmployeeVisibility(visibilityTarget, true);
              setVisibilityTarget(null);
            }}
          >
            Publish to employees
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
