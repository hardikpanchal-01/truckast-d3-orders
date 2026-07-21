import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = "tk_session";

/**
 * Logout endpoint for the static D3 pages (their hamburger-menu "LOGOUT" links here).
 * A plain link to /login could never log the user out: the session cookie stayed set,
 * so the middleware (hasSession && isLogin -> "/") bounced them right back into the app.
 * This clears the session cookie on the redirect response, so /login actually shows.
 */
export function GET(request: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL("/login", request.url));
  // Expire the cookie with the SAME path it was set with ("/") so it actually clears.
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
