import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';

interface AppHeaderProps {
  actions?: ReactNode;
  onOpenNavigation: () => void;
}

export function AppHeader({ actions, onOpenNavigation }: AppHeaderProps) {
  const hasActions = actions != null;

  return (
    <header
      data-testid="app-header"
      className={`relative z-30 flex h-16 w-full shrink-0 items-center gap-3 border-b border-border bg-card px-3 shadow-soft sm:px-5 ${
        hasActions
          ? 'sticky top-0'
          : 'sticky top-0 lg:static lg:hidden'
      }`}
    >
      <button
        type="button"
        onClick={onOpenNavigation}
        aria-label="Open navigation"
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          hasActions ? 'lg:hidden' : ''
        }`}
        data-testid="button-mobile-menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <span
        className={`min-w-0 flex-1 truncate font-heading text-base font-bold ${
          hasActions ? 'lg:hidden' : ''
        }`}
      >
        ScopeClear
      </span>

      {hasActions && (
        <div className="ml-auto flex min-w-0 shrink items-center justify-end gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}
