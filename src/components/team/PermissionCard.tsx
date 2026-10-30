import { useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  EmployeeRole,
  OperationalPermissions,
} from "../../../shared/employeePortal";
import { permissionNames } from "../../../shared/employeePortal";

const card =
  "rounded-2xl border border-border bg-card shadow-[0_3px_14px_rgba(33,54,43,.045)]";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";
const labels: Record<keyof OperationalPermissions, string> = {
  view_scope: "View job scope",
  view_variations: "View approved variations",
  view_documents: "View published documents",
  add_photos: "Upload site photos",
  add_notes: "Write private job notes",
  review_timesheets: "Review timesheets",
};

function roleLabel(role: EmployeeRole) {
  return role === "supervisor"
    ? "Leading Hand / Supervisor"
    : role === "admin"
      ? "Admin"
      : "Labourer";
}

export function PermissionCard({
  role,
  initial,
  save,
}: {
  role: EmployeeRole;
  initial: OperationalPermissions;
  save: (role: EmployeeRole, permissions: OperationalPermissions) => void;
}) {
  const [permissions, setPermissions] = useState(initial);
  return (
    <form
      className={`${card} p-5`}
      onSubmit={(event) => {
        event.preventDefault();
        save(role, permissions);
      }}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-success/10 text-success">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <h2 className="font-bold">{roleLabel(role)}</h2>
      </div>
      <div className="mt-4 space-y-2">
        {permissionNames.map((key) => (
          <label
            key={key}
            className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={permissions[key]}
              onChange={(event) =>
                setPermissions((previous) => ({
                  ...previous,
                  [key]: event.target.checked,
                }))
              }
            />
            <span className="text-sm">{labels[key]}</span>
          </label>
        ))}
      </div>
      <Button className={`${primary} mt-4 w-full`}>
        <Save className="h-4 w-4" />
        Save role
      </Button>
    </form>
  );
}
