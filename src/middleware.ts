import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "pgtsc_session";

/**
 * Protected-route gate.
 *  - Demo mode ON  → send visitors through /demo so any deep link just works.
 *  - Demo mode OFF → send them to the real login screen (production behaviour).
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (req.cookies.has(SESSION_COOKIE)) {
    // Expose the path so the layout can build an accurate fallback redirect
    // when a cookie exists but the session has already expired.
    const headers = new Headers(req.headers);
    headers.set("x-pathname", pathname + search);
    return NextResponse.next({ request: { headers } });
  }

  const demoMode = process.env.DEMO_MODE !== "false";
  const url = req.nextUrl.clone();
  url.pathname = demoMode ? "/demo" : "/login";
  url.search = demoMode ? `?next=${encodeURIComponent(pathname + search)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/teacher/:path*", "/student/:path*", "/parent/:path*", "/admin/:path*", "/host/:path*"],
};
