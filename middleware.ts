import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const isDev = process.env.NODE_ENV === "development";
  const username = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASS;

  if ((!isPreview && !isDev) || !username || !password) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    const [scheme, encoded] = authorization.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const separatorIndex = decoded.indexOf(":");
      const providedUser =
        separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex);
      const providedPass =
        separatorIndex === -1 ? "" : decoded.slice(separatorIndex + 1);
      if (providedUser === username && providedPass === password) {
        return NextResponse.next();
      }
    }
  }

  const response = new NextResponse("Authentication required", { status: 401 });
  response.headers.set("WWW-Authenticate", 'Basic realm="Preview"');
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
