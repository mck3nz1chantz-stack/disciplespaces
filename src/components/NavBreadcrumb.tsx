import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export type NavCrumb = {
  /** Visible label (user-facing: Groups, not “spaces”) */
  label: string;
  /** When set and not the last crumb, renders as a link */
  to?: string;
};

interface NavBreadcrumbProps {
  items: NavCrumb[];
  className?: string;
}

/**
 * Compact wayfinding trail: Groups › {name} · Groups › {space} › Bible
 */
export function NavBreadcrumb({ items, className = "" }: NavBreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={["min-w-0", className].filter(Boolean).join(" ")}
    >
      <ol className="flex items-center flex-wrap gap-x-1 gap-y-0.5 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const showLink = Boolean(item.to) && !isLast;

          return (
            <li
              key={`${item.label}-${i}`}
              className="inline-flex items-center gap-1 min-w-0 max-w-full"
            >
              {i > 0 ? (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted/80"
                  aria-hidden
                />
              ) : null}
              {showLink ? (
                <Link
                  to={item.to!}
                  className="shrink-0 font-medium text-primary touch-manipulation underline-offset-2 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={[
                    "min-w-0 truncate font-medium",
                    isLast ? "text-text" : "text-muted",
                  ].join(" ")}
                  aria-current={isLast ? "page" : undefined}
                  title={item.label}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
