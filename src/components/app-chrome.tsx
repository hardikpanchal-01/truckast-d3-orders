"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@/components/d3-ui";
import chrome from "@/components/d3-chrome.module.css";

/**
 * Renders the app chrome (dark TRUCKAST nav + centered content wrapper) around
 * every page — except the login screen, which is a standalone full-page layout.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login is a standalone full-page layout; the /orders route renders the D3
  // page inside its own full-screen iframe (which carries its own TRUCKAST nav),
  // so both bypass the shared app chrome. (/orders/[id] detail keeps the chrome.)
  if (pathname?.startsWith("/login") || pathname === "/orders") {
    return <>{children}</>;
  }

  return (
    <>
      <TopNav />
      {/* Below 980: full-width with a 20px gutter so the content fills the viewport and
          aligns with the full-width header (no empty strip on the right). Desktop: centered 1170px. */}
      <main className={chrome.main}>{children}</main>
    </>
  );
}
