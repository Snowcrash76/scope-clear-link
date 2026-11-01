import { ArrowLeft, Search } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

export interface AppHeaderProps {
  onOpenNavigation: () => void;
  onOpenSearch: () => void;
  backTo?: string;
  onBack?: () => void;
  accountInitials: string;
}

export function AppHeader({
  onOpenNavigation,
  onOpenSearch,
  backTo,
  onBack,
  accountInitials,
}: AppHeaderProps) {
  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-30 flex h-[calc(3.75rem+env(safe-area-inset-top))] w-full shrink-0 items-center gap-2 border-b border-border bg-card px-3 pt-[env(safe-area-inset-top)] shadow-soft md:hidden"
    >
      <div className="flex min-w-0 flex-1 items-center">
        {backTo ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to Jobs"
            className="shrink-0"
            data-testid="button-job-back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
        ) : (
          <BrandLogo variant="horizontal" className="w-[min(8.5rem,42vw)]" />
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenSearch}
          aria-label="Search jobs, quotes or clients"
          data-testid="button-global-search"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onOpenNavigation}
          aria-label="Open account and navigation"
          data-testid="button-account"
          className="!rounded-full font-semibold"
        >
          {accountInitials || "U"}
        </Button>
      </div>
    </header>
  );
}
