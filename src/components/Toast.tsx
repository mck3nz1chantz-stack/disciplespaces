import { Toaster } from "sonner";

/** Global toast host — mount once near the app root. */
export function ToastHost() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        className: "font-sans text-base",
        duration: 3500,
      }}
    />
  );
}
