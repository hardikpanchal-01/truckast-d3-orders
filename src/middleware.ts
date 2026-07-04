import { NextRequest, NextResponse } from "next/server";

// Gate the app behind the login screen: no session cookie → send to /login;
// already-logged-in users hitting /login → send home.
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("tk_session");
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static files
  // (anything with a file extension, e.g. /tkbanner.svg, /icons/*.png).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
