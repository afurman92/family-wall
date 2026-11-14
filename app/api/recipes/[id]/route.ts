import { NextResponse } from "next/server";
import { ensureSchema, getRecipe } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  const recipe = await getRecipe(id);
  if (!recipe) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ recipe }, { headers: { "Cache-Control": "no-store" } });
}
