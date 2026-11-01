import { Search } from "lucide-react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface SearchOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  title?: string;
  description?: string;
  resultSummary?: string;
  children?: ReactNode;
}

export function SearchOverlay({
  open,
  onOpenChange,
  value,
  onValueChange,
  title = "Search jobs, quotes or clients",
  description = "Search the records in your workspace.",
  resultSummary,
  children,
}: SearchOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="search-overlay"
        className="fixed inset-0 left-0 top-0 !flex h-[100dvh] w-screen !max-h-none max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:inset-0 sm:left-0 sm:top-0 sm:h-[100dvh] sm:max-w-none sm:rounded-none"
      >
        <DialogHeader className="border-b px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-left sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
          <label className="relative block shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              autoFocus
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="Search jobs, clients or references"
              aria-label="Search jobs, quotes or clients"
              name="workspace-search"
              autoComplete="off"
              className="min-h-12 pl-11"
            />
          </label>
          {resultSummary && (
            <p className="py-3 text-sm text-muted-foreground" aria-live="polite">
              {resultSummary}
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto py-2" aria-live="polite">
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search jobs, clients or references",
  className = "",
  name = "list-search",
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
  testId?: string;
}) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">Search this list</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        name={name}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`list-search-input h-11 min-h-11 rounded-xl pl-9 ${value ? "pr-10" : ""}`}
        data-testid={testId}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid={testId ? `${testId}-clear` : undefined}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </label>
  );
}

export function SearchFilterButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      aria-label="Search this list"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      Search
    </Button>
  );
}
