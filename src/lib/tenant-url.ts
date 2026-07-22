import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const TENANT_COOKIE = "selected_tenant";

/**
 * Put the tenant in the page URL — mirroring D3, whose URLs carry it
 * (`/dv/v1/sunrise/Truckast/JobsForFixedNodeID`) so you can see which tenant's data
 * you're looking at. Our tenant is normally held in the `selected_tenant` cookie, so
 * the URL shows nothing. This guard fixes that for the data pages:
 *
 *   - `?tenant=<x>` present  → the URL is AUTHORITATIVE: sync the cookie to it (so the
 *     data layer, which reads the cookie, loads that tenant) and proceed.
 *   - `?tenant` absent but a tenant IS selected → redirect to the same URL with
 *     `?tenant=<selected>` appended, so the address bar always shows the tenant.
 *   - nothing selected → proceed (default tenant).
 *
 * Returns a redirect Response to return early, or null to continue serving the page.
 */
export async function applyTenantToUrl(request: Request): Promise<NextResponse | null> {
  const url = new URL(request.url);
  const store = await cookies();
  const urlTenant = (url.searchParams.get("tenant") || "").trim();
  const cookieTenant = (store.get(TENANT_COOKIE)?.value || "").trim();

  if (urlTenant) {
    if (urlTenant !== cookieTenant) {
      store.set(TENANT_COOKIE, urlTenant, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return null;
  }

  if (cookieTenant) {
    url.searchParams.set("tenant", cookieTenant);
    return NextResponse.redirect(url);
  }

  return null;
}
