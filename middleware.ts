import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Three ways in:
//   /            -> human door, per-member Basic auth (MEMBERS) or legacy BASIC_AUTH_USER/PASS
//   /frame/<tok> -> frame door, exact token only, read-only
//   /api/items   -> GET with the frame token (read-only) OR any member (read/write)
//
// A successful member login injects x-member downstream, so every write is
// attributable without sessions or cookies.

type Member = { name: string; pass: string };

function members(): Member[] {
  const raw = process.env.MEMBERS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(":");
      return i === -1
        ? { name: pair, pass: "" }
        : { name: pair.slice(0, i).trim(), pass: pair.slice(i + 1) };
    })
    .filter((m) => m.name && m.pass);
}

function check(header: string, list: Member[]): Member | null {
  if (!header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(":");
    if (i === -1) return null;
    const u = decoded.slice(0, i);
    const p = decoded.slice(i + 1);
    return list.find((m) => m.name === u && m.pass === p) || null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- frame door: exact token or 404, decided at the edge
  if (pathname.startsWith("/frame/")) {
    const token = pathname.slice("/frame/".length).split("/")[0];
    const expected = process.env.FRAME_TOKEN;
    if (!expected || token !== expected) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.next();
  }

  // ---- item/document/recipe reads for the frame (token in the query, GET only)
  if (
    pathname.startsWith("/api/items") ||
    pathname.startsWith("/api/documents") ||
    pathname.startsWith("/api/recipes") ||
    pathname.startsWith("/api/plants") ||
    pathname.startsWith("/api/air-fryer")
  ) {
    const frameTok = req.nextUrl.searchParams.get("token");
    if (
      req.method === "GET" &&
      frameTok &&
      process.env.FRAME_TOKEN &&
      frameTok === process.env.FRAME_TOKEN
    ) {
      return NextResponse.next();
    }
    // otherwise fall through to member auth below
  } else if (
    pathname.startsWith("/app/") ||
    pathname.startsWith("/api/frame") ||
    pathname.startsWith("/api/debug") ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/llms.txt"
  ) {
    return NextResponse.next();
  }

  const list = members();
  const legacyPass = process.env.BASIC_AUTH_PASS;
  const legacyUser = process.env.BASIC_AUTH_USER || "af";

  // Nothing configured at all -> refuse to serve private routes.
  if (list.length === 0 && !legacyPass) {
    return new NextResponse("Not configured: set MEMBERS or BASIC_AUTH_PASS", { status: 503 });
  }

  const header = req.headers.get("authorization") || "";

  const who =
    list.length > 0
      ? check(header, list)
      : check(header, [{ name: legacyUser, pass: legacyPass as string }]);

  if (who) {
    const headers = new Headers(req.headers);
    headers.set("x-member", who.name);
    return NextResponse.next({ request: { headers } });
  }

  // An agent that lands on the door should be told where the instructions are.
  return new NextResponse("Authentication required.\nAgents: read /llms.txt for the API and the house rules.\n", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="familia", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
