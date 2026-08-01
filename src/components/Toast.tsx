import { Toaster } from "sonner";

/**
 * Global toast host — fixed overlay only (never in document flow).
 * Bottom-center above the bottom nav so messages don’t fight the sticky
 * header or shove the page when they open/close.
 */
export function ToastHost() {
  // Clear the fixed bottom tab bar + home indicator
  const aboveNav =
    "calc(4.75rem + env(safe-area-inset-bottom, 0px))" as const;

  return (
    <Toaster
      position="bottom-center"
      richColors
      closeButton
      /* Always-expanded stacks reflow hard when a toast opens/closes */
      expand={false}
      visibleToasts={2}
      gap={8}
      offset={{ bottom: aboveNav }}
      mobileOffset={{ bottom: aboveNav }}
      toastOptions={{
        className: "ds-toast font-sans",
        duration: 3800,
        classNames: {
          toast: "ds-toast",
          title: "ds-toast-title",
          description: "ds-toast-desc",
          error: "ds-toast-error",
          success: "ds-toast-success",
          actionButton: "ds-toast-action",
          closeButton: "ds-toast-close",
        },
      }}
    />
  );
}
