import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/products/:path*",
    "/stores/:path*",
    "/listings/:path*",
    "/calculator/:path*",
    "/inventory/:path*",
    "/settings/:path*",
  ],
};
