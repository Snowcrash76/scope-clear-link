import { useEffect, useRef, useState } from "react";
import { File, FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface ProjectDocumentItem {
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

export type ProjectDocumentGroup =
  | "Site plans & drawings"
  | "Photos"
  | "Reports & certificates"
  | "Client documents"
  | "Other";

export function groupProjectDocument(doc: ProjectDocumentItem): ProjectDocumentGroup {
  const purpose = (doc.purpose ?? "").toLowerCase();
  if (purpose.includes("plan") || purpose.includes("drawing")) return "Site plans & drawings";
  if (purpose.includes("report") || purpose.includes("certificate")) return "Reports & certificates";
  if (purpose.includes("photo") || (doc.file_type ?? "").toLowerCase().startsWith("image/")) return "Photos";
  if (
    purpose === "client_upload" ||
    purpose === "client_uploaded" ||
    purpose === "uploaded_by_client"
  ) return "Client documents";
  return "Other";
}

export function filterProjectDocuments(
  docs: ProjectDocumentItem[],
  search: string,
  typeFilter: string,
): ProjectDocumentItem[] {
  return docs.filter((doc) => {
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
}

export function storagePathForDocument(fileUrl: string): string {
  const marker = "/project-documents/";
  const markerIndex = fileUrl.indexOf(marker);
  const path = markerIndex >= 0 ? fileUrl.slice(markerIndex + marker.length) : fileUrl;
  return path.split("?")[0].replace(/^\/+/, "");
}

function iconFor(fileType: string | null) {
  const type = (fileType ?? "").toLowerCase();
  if (type.startsWith("image/")) return ImageIcon;
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return FileSpreadsheet;
  if (type.includes("pdf")) return FileText;
  return File;
}

interface DocumentThumbnailProps {
  document: ProjectDocumentItem;
  className?: string;
}

export function DocumentThumbnail({ document, className }: DocumentThumbnailProps) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const displayName = document.display_name || document.file_name;
  const fileType = (document.file_type ?? "").toLowerCase();
  const isImage = fileType.startsWith("image/");
  const isPdf = fileType.includes("pdf");
  const isPreviewable = isImage || isPdf;
  const FileIcon = iconFor(document.file_type);

  useEffect(() => {
    const node = host.current;
    if (!node || !isPreviewable) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "120px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isPreviewable]);

  useEffect(() => {
    if (!visible || !isPreviewable || signedUrl || failed) return;
    let active = true;
    void supabase.storage
      .from("project-documents")
      .createSignedUrl(storagePathForDocument(document.file_url), 300)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.signedUrl) {
          setFailed(true);
          return;
        }
        setSignedUrl(data.signedUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [document.file_url, failed, isPreviewable, signedUrl, visible]);

  return (
    <div
      ref={host}
      className={cn(
        "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/60 text-muted-foreground",
        className,
      )}
      aria-label={isImage ? `Image thumbnail for ${displayName}` : isPdf ? `First page thumbnail for ${displayName}` : `File icon for ${displayName}`}
      role={isPreviewable ? "group" : undefined}
      data-testid={`document-thumbnail-${document.id}`}
    >
      {!isPreviewable || failed ? (
        <div className="flex flex-col items-center justify-center gap-1 text-center">
          <FileIcon className="h-6 w-6" aria-hidden="true" />
          {failed && <span className="px-1 text-[10px] leading-tight">Preview unavailable</span>}
        </div>
      ) : !visible || !signedUrl ? (
        <div className="h-full w-full animate-pulse bg-muted" aria-label={`Loading thumbnail for ${displayName}`} />
      ) : isImage ? (
        <img
          src={signedUrl}
          alt={`Preview thumbnail of ${displayName}`}
          loading="lazy"
          onError={() => {
            setFailed(true);
            setSignedUrl(null);
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <iframe
          src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          title={`First page PDF thumbnail of ${displayName}`}
          aria-label={`First page preview of ${displayName}`}
          tabIndex={-1}
          onError={() => {
            setFailed(true);
            setSignedUrl(null);
          }}
          className="pointer-events-none h-[calc(100%+28px)] w-[calc(100%+2px)] -translate-y-3 border-0"
        />
      )}
    </div>
  );
}
