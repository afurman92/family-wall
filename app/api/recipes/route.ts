import { NextResponse } from "next/server";
import { createRecipe, ensureSchema, listRecipes } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  const recipes = await listRecipes();
  return NextResponse.json(
    { recipes, count: recipes.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const who = req.headers.get("x-member");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 160) : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x: string) => x.slice(0, 400)) : [];

  const recipe = await createRecipe({
    title,
    category: body?.category === "especial" ? "especial" : "diaria",
    ingredients: arr(body?.ingredients),
    steps: arr(body?.steps),
    body: Array.isArray(body?.body) ? body.body : [],
    notion_id: typeof body?.notion_id === "string" ? body.notion_id : null,
  });

  return NextResponse.json({ recipe }, { status: 201 });
}
