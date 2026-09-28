import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

/**
 * The dashboard reads its view and filters from the querystring, so the shell
 * uses `useSearchParams`. The App Router requires a Suspense boundary above
 * any component that does, otherwise the route cannot be statically
 * prerendered. The fallback matches the shell frame so the transition does not
 * shift the layout.
 */
export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Loading dashboard"
          className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground"
        >
          Loading dashboard
        </div>
      }
    >
      <AppShell />
    </Suspense>
  );
}
