import { Toaster } from "sonner";

/**
 * Global toast host — mount once near the app root.
 * Mobile: safe-area + side padding so text is not clipped by notch / home bar.
 * Extra layout fixes live in index.css ([data-sonner-toaster]).
 */
export function ToastHost() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      expand
      visibleToasts={3}
      offset={16}
      mobileOffset={12}
      toastOptions={{
        className: "ds-toast font-sans",
        duration: 4000,
      }}
    />
  );
}
