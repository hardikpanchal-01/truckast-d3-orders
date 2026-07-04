"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@/components/d3-ui";

/**
 * Renders the app chrome (dark TRUCKAST nav + centered content wrapper) around
 * every page — except the login screen, which is a standalone full-page layout.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <>
      <TopNav />
      {/* Below 980: full-width with a 20px gutter so the content fills the viewport and
          aligns with the full-width header (no empty strip on the right). Desktop: centered 1170px. */}
      <main className="w-full px-5 pt-5 pb-4 min-[980px]:mx-auto min-[980px]:max-w-[1170px] min-[980px]:px-0 sm:pb-6">
        {children}
      </main>
    </>
  );
}
