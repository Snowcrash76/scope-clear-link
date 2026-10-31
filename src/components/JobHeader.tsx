import type { ReactNode } from 'react';

interface JobHeaderProps {
  children: ReactNode;
}

export function JobHeader({ children }: JobHeaderProps) {
  return (
    <div
      data-testid="job-header"
      className="sticky top-16 z-20 border-b border-border bg-card shadow-soft lg:top-0"
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">{children}</div>
    </div>
  );
}
