import type { ReactNode } from 'react';

interface JobHeaderProps {
  children: ReactNode;
}

export function JobHeader({ children }: JobHeaderProps) {
  return (
    <div data-testid="job-header" className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">{children}</div>
    </div>
  );
}
