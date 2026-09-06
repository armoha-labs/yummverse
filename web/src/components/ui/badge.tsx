import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold", {
  variants: {
    variant: {
      default: "bg-accent text-white",
      secondary: "bg-secondary-soft text-text",
      success: "bg-success-soft text-success",
      danger: "bg-danger-soft text-danger",
      outline: "border border-border bg-bg text-text-muted",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
