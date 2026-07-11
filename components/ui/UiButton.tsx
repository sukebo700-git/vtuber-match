import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

type UiButtonBaseProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type UiButtonAnchorProps = UiButtonBaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

type UiButtonButtonProps = UiButtonBaseProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
};

export function UiButton(props: UiButtonAnchorProps | UiButtonButtonProps) {
  const { children, className, variant = "primary", ...rest } = props;
  const classes = [variant === "primary" ? "primary-button" : "secondary-button", className].filter(Boolean).join(" ");

  if ("href" in rest && typeof rest.href === "string") {
    return (
      <a className={classes} {...rest}>
        {children}
      </a>
    );
  }

  const { type = "button", ...buttonProps } = rest as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button className={classes} type={type} {...buttonProps}>
      {children}
    </button>
  );
}
