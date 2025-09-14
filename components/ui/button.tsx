"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-transparent",
  {
    variants: {
      variant: {
        default:
          "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 border border-neutral-700",
        secondary:
          "bg-neutral-900 text-neutral-100 hover:bg-neutral-800 border border-neutral-800",
        outline:
          "border border-neutral-700 bg-transparent hover:bg-neutral-800 text-neutral-100",
        ghost: "hover:bg-neutral-800/50 hover:text-neutral-100",
        destructive:
          "bg-red-900 text-red-100 hover:bg-red-800 border border-red-800",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

