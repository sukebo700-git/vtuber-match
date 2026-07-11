import type { HTMLAttributes, ReactNode } from "react";

type UiBadgeVariant = "pill" | "official";

type UiBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  className?: string;
  variant?: UiBadgeVariant;
};

export function UiBadge({ children, className, variant = "pill", ...props }: UiBadgeProps) {
  const classes = [variant === "official" ? "official-badge" : "pill", className].filter(Boolean).join(" ");

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
