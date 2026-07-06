"use client";

/**
 * Full-viewport iframe that renders the dynamic D3 orders HTML in isolation.
 * srcDoc is same-origin, so the page's Bootstrap 2.2 CSS and the tile links
 * (target="_top") work without leaking into / colliding with the host app's
 * Tailwind styles.
 */
export function OrdersFrame({ html }: { html: string }) {
  return (
    <iframe
      title="Dolese Orders"
      srcDoc={html}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
