import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-dashed px-5 py-9 text-center shadow-none sm:px-8 ${className}`}>
      {icon && <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary">{icon}</span>}
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-muted-foreground">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}
