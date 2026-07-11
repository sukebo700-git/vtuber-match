import type { HTMLAttributes, ReactNode } from "react";

type UiPanelElement = "section" | "article" | "aside" | "div";
type UiPanelVariant = "status" | "landing";

type UiPanelProps = HTMLAttributes<HTMLElement> & {
  as?: UiPanelElement;
  children: ReactNode;
  className?: string;
  variant?: UiPanelVariant;
};

export function UiPanel({ as: Tag = "section", children, className, variant = "status", ...props }: UiPanelProps) {
  const baseClass = variant === "landing" ? "landing-section" : "status-band";
  const classes = [baseClass, className].filter(Boolean).join(" ");

  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}
