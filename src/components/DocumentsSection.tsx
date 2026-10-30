import { useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ProjectDocument {
  id: string;
  file_name: string;
  display_name: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  employee_visible?: boolean;
  purpose?: string | null;
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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [photoUpload, setPhotoUpload] = useState(false);

  const documentGroups = useMemo(() => {
    const filtered = documents.filter((doc) => {
      const text = `${doc.display_name || doc.file_name} ${doc.purpose ?? ""} ${doc.file_type ?? ""}`.toLowerCase();
      const matchesSearch = text.includes(search.trim().toLowerCase());
      const type = (doc.file_type ?? "").toLowerCase();
      const matchesType = typeFilter === "all"
        || (typeFilter === "image" && type.startsWith("image/"))
        || (typeFilter === "pdf" && type.includes("pdf"))
        || (typeFilter === "spreadsheet" && (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")))
        || (typeFilter === "other" && !type.startsWith("image/") && !type.includes("pdf") && !type.includes("spreadsheet") && !type.includes("excel") && !type.includes("csv"));
      return matchesSearch && matchesType;
    });
    const groupFor = (doc: ProjectDocument) => {
      const purpose = (doc.purpose ?? "").toLowerCase();
      if (purpose.includes("photo")) return "Photos";
      if (purpose.includes("plan") || purpose.includes("drawing")) return "Site plans & drawings";
      if (purpose.includes("report") || purpose.includes("certificate")) return "Reports & certificates";
      if (purpose === "client_upload" || purpose === "client_uploaded" || purpose === "uploaded_by_client") return "Client documents";
      return "Other";
    };
    const order = ["Site plans & drawings", "Photos", "Reports & certificates", "Client documents", "Other"];
    return order.map((title) => ({
      title,
      items: filtered.filter((doc) => groupFor(doc) === title),
    })).filter((group) => group.items.length);
  }, [documents, search, typeFilter]);

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
    setPreviewDoc(doc);
    setPreviewUrl("");
    setPreviewLoading(true);
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

      const { data, error } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(filePath, 300);

      if (error) {
        console.error("Signed URL error:", error);
        throw error;
      }

      setPreviewUrl(data.signedUrl);
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error("Failed to view document");
      setPreviewDoc(null);
    } finally {
      setPreviewLoading(false);
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
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button className="min-h-11 flex-1 sm:flex-none" onClick={() => { setPhotoUpload(false); setUploadModalOpen(true); }}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <Button variant="outline" className="min-h-11 flex-1 sm:hidden" onClick={() => { setPhotoUpload(true); setUploadModalOpen(true); }}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Take photo
          </Button>
          </div>
        </div>

        <p className="rounded-lg border border-info/25 bg-info/10 p-3 text-sm text-foreground">
          Client access follows the existing secure client-page rules. This schema has no separate client-only visibility setting; Team access controls only employee visibility.
        </p>
        <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto] sm:items-center">
          <Input aria-label="Search job documents" placeholder="Search documents" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <span className="shrink-0 font-medium">Type</span>
            <select aria-label="Filter documents by type" className="h-11 min-w-32 rounded-md border border-input bg-background px-3" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All files</option><option value="image">Images</option><option value="pdf">PDFs</option><option value="spreadsheet">Spreadsheets</option><option value="other">Other</option>
            </select>
          </label>
          <div className="flex gap-1" aria-label="Document layout">
            <Button type="button" variant={layout === "list" ? "accent" : "outline"} className="min-h-11" aria-pressed={layout === "list"} onClick={() => setLayout("list")}>List</Button>
            <Button type="button" variant={layout === "grid" ? "accent" : "outline"} className="min-h-11" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>Grid</Button>
          </div>
        </div>

        {documents.length > 0 && documentGroups.length ? (
          <div className="space-y-5">
            {documentGroups.map(({ title, items }) => (
            <section key={title} aria-labelledby={`document-group-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}>
              <h3 id={`document-group-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{title} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 tabular-nums">{items.length}</span></h3>
              <Card className={cn(layout === "grid" ? "grid gap-3 border-0 bg-transparent shadow-none sm:grid-cols-2 xl:grid-cols-3" : "divide-y")}>
            {items.map((doc) => {
              const FileIcon = getFileIcon(doc.file_type);
              const hasCustomName =
                doc.display_name && doc.display_name !== doc.file_name;
              return (
                <div
                  key={doc.id}
                  className={cn(
                    "p-3 sm:p-4 flex min-w-0 flex-wrap items-center gap-3 transition-colors",
                    layout === "grid" ? "rounded-xl border border-border bg-card shadow-soft" : "sm:flex-nowrap hover:bg-secondary/30",
                  )}
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
                      Team access
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
            </section>
            ))}
          </div>
        ) : documents.length ? (
          <Card className="p-10 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-semibold">No documents match these filters</p><Button type="button" variant="link" className="mt-1 min-h-11" onClick={() => { setSearch(""); setTypeFilter("all"); }}>Clear search and filters</Button></Card>
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
          photoOnly={photoUpload}
        />

        <EditDocumentModal
          document={editingDocument}
          open={!!editingDocument}
          onOpenChange={(open) => !open && setEditingDocument(null)}
          onSave={onRefresh}
        />
        <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) { setPreviewDoc(null); setPreviewUrl(""); } }}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>{previewDoc ? displayName(previewDoc) : "Document preview"}</DialogTitle>
              <DialogDescription>Secure preview link expires after five minutes.</DialogDescription>
            </DialogHeader>
            <div className="grid min-h-52 place-items-center overflow-auto rounded-xl bg-muted/50">
              {previewLoading ? <div role="status" className="animate-pulse text-sm text-muted-foreground">Loading preview…</div> : previewUrl && previewDoc?.file_type?.startsWith("image/") ? (
                <img src={previewUrl} alt={`Preview of ${displayName(previewDoc)}`} className="max-h-[65dvh] max-w-full object-contain" />
              ) : previewUrl && previewDoc?.file_type?.includes("pdf") ? (
                <iframe src={previewUrl} title={`PDF preview of ${displayName(previewDoc)}`} className="h-[65dvh] w-full border-0" />
              ) : previewUrl ? <p className="p-6 text-sm text-muted-foreground">This file type can’t be previewed. Use Download to open the file.</p> : null}
            </div>
          </DialogContent>
        </Dialog>
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
