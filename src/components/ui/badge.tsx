import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border border-input bg-card text-foreground hover:bg-muted",
        destructive: "border border-destructive/20 bg-[hsl(var(--danger-soft))] text-destructive",
        outline: "border border-input bg-card text-foreground",
        success: "border border-success/20 bg-[hsl(var(--success-soft))] text-success",
        pending: "border border-warning/20 bg-[hsl(var(--warning-soft))] text-warning",
        warning: "border border-warning/20 bg-[hsl(var(--warning-soft))] text-warning",
        included: "border border-success/20 bg-[hsl(var(--success-soft))] text-success",
        excluded: "border border-destructive/20 bg-[hsl(var(--danger-soft))] text-destructive",
        assumption: "border border-warning/20 bg-[hsl(var(--warning-soft))] text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
