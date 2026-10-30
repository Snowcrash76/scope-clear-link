import { PhotoGallery as EmployeePhotoGallery } from "@/components/employee/PhotoGallery";
import type { PortalDocument } from "../../../shared/employeePortal";

export function PhotoGallery({
  documents,
  employee = false,
}: {
  documents: PortalDocument[];
  employee?: boolean;
}) {
  return <EmployeePhotoGallery documents={documents} employee={employee} />;
}
