import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { photoFor } from "../../../../../lib/people";

export const dynamic = "force-dynamic";

// The household's faces. Uploaded once to the private Blob store; the URL is
// never exposed, this route is the only thing holding the token. Cached hard
// because a face does not change, and the wall asks for it on every refresh.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const allowed = req.headers.get("x-member") || req.headers.get("x-frame");
  if (!allowed) return NextResponse.json({ error: "authentication required" }, { status: 401 });

  const { id } = await ctx.params;
  const path = photoFor(id);
  if (!path) return NextResponse.json({ error: "no photo for that person" }, { status: 404 });

  let blob;
  try {
    blob = await get(path, { access: "private" });
  } catch (e) {
    console.warn("[people] blob get failed", id, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "could not read the photo" }, { status: 502 });
  }
  if (!blob) return NextResponse.json({ error: "photo not found" }, { status: 404 });

  return new NextResponse(blob.stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": blob.blob.contentType || "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
