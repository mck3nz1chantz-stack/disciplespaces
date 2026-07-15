import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  fullWidth?: boolean;
}

/** Shared motion + pointer feedback (desktop hover + press). */
const interactive =
  "cursor-pointer select-none transition-all duration-150 ease-out " +
  "hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98] active:shadow-sm " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
  "disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary-soft active:bg-primary-soft",
  secondary:
    "bg-surface-muted text-primary border border-border hover:bg-border/50 hover:border-primary/25",
  ghost:
    "bg-transparent text-primary hover:bg-surface-muted hover:shadow-sm",
  danger: "bg-danger text-white shadow-sm hover:opacity-90",
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
        interactive,
        "disabled:opacity-50 disabled:pointer-events-none",
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
