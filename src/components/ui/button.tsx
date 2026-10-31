import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))] shadow-soft hover:shadow-card",
        destructive: "border border-destructive/25 bg-card text-destructive hover:bg-[hsl(var(--danger-soft))] shadow-none",
        outline: "border border-input bg-card text-foreground hover:bg-muted",
        secondary: "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        accent: "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))] shadow-soft hover:shadow-card font-semibold",
        success: "bg-approved text-approved-foreground hover:bg-approved/90 shadow-soft",
        approve: "bg-approved text-approved-foreground hover:bg-approved/90 shadow-soft hover:shadow-card font-semibold",
        decline: "border border-destructive/20 bg-[hsl(var(--danger-soft))] text-destructive hover:bg-[hsl(var(--danger-soft))]",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-[10px] px-3",
        lg: "h-11 rounded-[10px] px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
