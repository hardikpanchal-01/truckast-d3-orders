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
      {/* px-5 (20px) matches the header gutter so content lines up with the nav. */}
      <main className="mx-auto w-full max-w-[724px] pt-5 pb-4 min-[980px]:max-w-[1170px] min-[980px]:px-5 sm:pb-6">
        {children}
      </main>
    </>
  );
}
