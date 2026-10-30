import type { ReactNode } from 'react';

interface PageLayoutProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  headerless?: boolean;
  className?: string;
  testId?: string;
}

export function PageLayout({
  title,
  description,
  actions,
  children,
  headerless = false,
  className = '',
  testId,
}: PageLayoutProps) {
  return (
    <main className={`mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 ${className}`} data-testid={testId}>
      {!headerless && title && (
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">{title}</h1>
            {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </main>
  );
}
