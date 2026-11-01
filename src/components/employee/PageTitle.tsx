import type { ReactNode } from "react";

export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="break-words text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1 !text-sm !leading-5 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
