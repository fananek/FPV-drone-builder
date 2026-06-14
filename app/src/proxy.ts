import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const proxyHandler = auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const roles = req.auth?.user?.roles || [];

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");
  const isProfileRoute = nextUrl.pathname.startsWith("/profile");

  // 1. Authentication and Authorization Guard
  if (isAdminRoute) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", nextUrl);
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    const hasAdminRole = roles.includes("system_admin") || roles.includes("metadata_admin");
    if (!hasAdminRole) {
      return new NextResponse("Forbidden - Admin Access Required", { status: 403 });
    }
  }

  if (isDashboardRoute || isProfileRoute) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", nextUrl);
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect bare `/builds` to dashboard or login
  if (nextUrl.pathname === "/builds" || nextUrl.pathname === "/builds/") {
    return NextResponse.redirect(new URL(isLoggedIn ? "/dashboard" : "/login", nextUrl));
  }

  // 2. Anonymous Session Provisioning
  let response = NextResponse.next();
  const anonSessionId = req.cookies.get("fpv-anon-session-id")?.value;

  if (!anonSessionId) {
    const newAnonId = crypto.randomUUID();
    // Set the cookie on our response object
    response.cookies.set("fpv-anon-session-id", newAnonId, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return response;
});

export default proxyHandler;
export { proxyHandler as proxy };

// Match all routes except static assets, favicon, and API routes (except Auth API)
export const config = {
  matcher: [
    "/((?!api/v1|_next/static|_next/image|favicon.ico|Seed|Specs).*)",
  ],
};
