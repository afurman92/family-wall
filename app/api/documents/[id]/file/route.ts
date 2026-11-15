import { NextResponse } from "next/server";
import { del, get, put } from "@vercel/blob";
import { ensureSchema, getDocument, updateDocument } from "../../../../../lib/db";

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

  // A passport is a photo as often as a PDF; serve it as what it actually is.
  const type = blob.blob.contentType || "application/octet-stream";
  const ext =
    type === "application/pdf" ? "pdf"
    : type === "image/png" ? "png"
    : type === "image/webp" ? "webp"
    : type === "image/heic" ? "heic"
    : type.startsWith("image/") ? "jpg"
    : "bin";

  return new NextResponse(blob.stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${safe}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// Upload / replace the scan for one document. Private Blob store: the URL is
// stored in the row but never handed to the browser — reads go through GET.
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = req.headers.get("x-member");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "empty file" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 15 MB)" }, { status: 413 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "unsupported type — pdf, jpg, png, webp or heic" },
      { status: 415 }
    );
  }

  const previous = doc.file_url;
  const blob = await put(`documents/${id}-${Date.now()}.${ext}`, file, {
    access: "private",
    contentType: file.type,
    addRandomSuffix: false,
  });

  const updated = await updateDocument(id, { file_url: blob.url });

  // Replace, not accumulate: the old scan stops existing.
  if (previous && previous !== blob.url) {
    try {
      await del(previous);
    } catch (e) {
      console.warn("[documents] could not delete previous blob", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, document: updated }, { status: 201 });
}
