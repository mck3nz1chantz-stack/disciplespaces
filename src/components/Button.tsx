import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-soft active:bg-primary-soft shadow-sm",
  secondary:
    "bg-surface-muted text-primary border border-border hover:bg-border/40",
  ghost: "bg-transparent text-primary hover:bg-surface-muted",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  children,
  fullWidth,
  className = "",
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3",
        "text-base font-medium touch-manipulation tap-target",
        "transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
