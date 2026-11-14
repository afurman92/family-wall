import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { ensureSchema, getDocument } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

// Streams the scan for one document out of the private Blob store.
// The blob URL is never exposed to the client: the store is private and this
// route is the only thing that holds the token.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = req.headers.get("x-member");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const doc = await getDocument(id);
  if (!doc || !doc.file_url) {
    return NextResponse.json({ error: "no scan for this document" }, { status: 404 });
  }

  let blob;
  try {
    blob = await get(doc.file_url, { access: "private" });
  } catch (e) {
    console.warn("[documents] blob get failed", id, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "could not read the scan" }, { status: 502 });
  }
  if (!blob) return NextResponse.json({ error: "scan not found" }, { status: 404 });

  const safe = `${doc.country ?? "doc"}-${doc.doc_type ?? "scan"}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");

  return new NextResponse(blob.stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safe}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
