import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  as?: "div" | "article" | "section";
  padding?: "sm" | "md" | "lg";
}

const pad: Record<NonNullable<CardProps["padding"]>, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Card({
  children,
  as: Tag = "div",
  padding = "md",
  className = "",
  ...rest
}: CardProps) {
  return (
    <Tag
      className={[
        "rounded-[var(--radius-card)] bg-surface/95 border border-border/90",
        "shadow-[var(--shadow-card)] backdrop-blur-sm",
        pad[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </Tag>
  );
}
