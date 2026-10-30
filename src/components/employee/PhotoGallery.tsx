import { Camera } from "lucide-react";
import { portalRequest } from "@/hooks/useEmployeePortal";
import type { PortalDocument } from "../../../shared/employeePortal";

async function openCapabilityUrl(path: string) {
  const viewer = window.open("about:blank", "_blank");
  if (viewer) viewer.opener = null;
  try {
    if (!viewer) {
      throw new Error(
        "Your browser blocked the document window. Allow pop-ups and try again.",
      );
    }
    const response = await portalRequest<{ url: string }>(
      path,
      undefined,
      "GET",
    );
    viewer.location.href = response.url;
  } catch (error) {
    viewer?.close();
    window.alert(
      error instanceof Error
        ? error.message
        : "Something went wrong. Please try again.",
    );
  }
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));

export function PhotoGallery({
  documents,
  employee = false,
}: {
  documents: PortalDocument[];
  employee?: boolean;
}) {
  const photos = documents.filter(
    (document) =>
      (document.purpose || "").toLowerCase().includes("photo") ||
      !!document.photo_stage,
  );
  const prefix = employee ? "/employee" : "/team";
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-success" />
        <h2 className="font-bold">Site photo log</h2>
      </div>
      {photos.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {photos.map((document) => (
            <button
              key={document.id}
              className="min-h-20 rounded-xl border border-border p-3 text-left hover:bg-muted"
              onClick={() =>
                void openCapabilityUrl(`${prefix}/documents/${document.id}/url`)
              }
            >
              <span className="block truncate text-sm font-semibold">
                {document.caption ||
                  document.display_name ||
                  document.file_name}
              </span>
              <span className="mt-1 block text-xs capitalize text-muted-foreground">
                {document.photo_stage || "site photo"} ·{" "}
                {formatDate(document.created_at)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Photos added on site will be listed here.
        </p>
      )}
    </section>
  );
}
