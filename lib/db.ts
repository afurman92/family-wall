import { createPool, type VercelPool } from "@vercel/postgres";

// One table for everything the family adds: tasks, notes, events, shopping.
// Kinds are constrained in SQL so a typo can't create a fifth category.

export type Kind = "task" | "note" | "event" | "shop";

export type Item = {
  id: number;
  kind: Kind;
  title: string;
  detail: string | null;
  who: string | null;
  due_at: string | null;
  done: boolean;
  created_by: string;
  created_at: string;
  updated_at: string | null;
};

let pool: VercelPool | null = null;
let schemaReady = false;

function connectionString(): string | null {
  const direct =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (direct) return direct;

  // Vercel Marketplace integrations prefix the vars with the resource name,
  // e.g. MYKITCHEN_POSTGRES_URL. Accept any such prefix, but avoid the
  // unpooled/non-pooling variants which break in serverless.
  const candidates = Object.keys(process.env).filter(
    (k) =>
      /_(POSTGRES_URL|DATABASE_URL|POSTGRES_PRISMA_URL)$/.test(k) &&
      !/UNPOOLED|NON_POOLING|NO_SSL/.test(k)
  );
  const best =
    candidates.find((k) => k.endsWith("_POSTGRES_URL")) ??
    candidates.find((k) => k.endsWith("_DATABASE_URL")) ??
    candidates[0];
  return best ? process.env[best] ?? null : null;
}

export function db(): VercelPool | null {
  const cs = connectionString();
  if (!cs) return null;
  if (!pool) pool = createPool({ connectionString: cs, max: 3 });
  return pool;
}

/** Creates the table on first use. Idempotent, so it is safe to call every request. */
export async function ensureSchema(): Promise<boolean> {
  const p = db();
  if (!p) return false;
  if (schemaReady) return true;
  await p.query(`
    CREATE TABLE IF NOT EXISTS items (
      id          BIGSERIAL PRIMARY KEY,
      kind        TEXT NOT NULL CHECK (kind IN ('task','note','event','shop')),
      title       TEXT NOT NULL,
      detail      TEXT,
      who         TEXT,
      due_at      TIMESTAMPTZ,
      done        BOOLEAN NOT NULL DEFAULT false,
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS items_open_idx ON items (kind, done, due_at)`);

  // Identity documents have their own shape: an expiry date is the whole point.
  await p.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id           BIGSERIAL PRIMARY KEY,
      country      TEXT,
      doc_type     TEXT,
      number       TEXT,
      issued_on    DATE,
      expires_on   DATE,
      owner        TEXT,
      file_url     TEXT,
      note         TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS documents_expiry_idx ON documents (expires_on)`);

  // Recipes and plants carried over from Notion. `body` keeps the original block
  // order so a recipe renders the way it was written, not as flattened text.
  await p.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id           BIGSERIAL PRIMARY KEY,
      title        TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'diaria',
      ingredients  TEXT[] NOT NULL DEFAULT '{}',
      steps        TEXT[] NOT NULL DEFAULT '{}',
      body         JSONB NOT NULL DEFAULT '[]',
      notion_id    TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS recipes_cat_idx ON recipes (category, title)`);

  await p.query(`
    CREATE TABLE IF NOT EXISTS plants (
      id           BIGSERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      location     TEXT,
      care         TEXT,
      image_url    TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Air fryer cheat sheet: one row per ingredient + portion size.
  await p.query(`
    CREATE TABLE IF NOT EXISTS air_fryer (
      id          BIGSERIAL PRIMARY KEY,
      ingredient  TEXT NOT NULL,
      servings    INTEGER NOT NULL DEFAULT 2,
      minutes     INTEGER,
      temp_f      INTEGER,
      mode        TEXT,
      note        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await p.query(`ALTER TABLE air_fryer ADD COLUMN IF NOT EXISTS mode TEXT`);
  await p.query(`CREATE INDEX IF NOT EXISTS air_fryer_sort_idx ON air_fryer (lower(ingredient), servings)`);

  schemaReady = true;
  return true;
}

export type RecipeRow = {
  id: number;
  title: string;
  category: string;
  ingredient_count?: number;
  step_count?: number;
  ingredients?: string[];
  steps?: string[];
  body?: unknown;
};

export async function listRecipes(): Promise<RecipeRow[]> {
  const p = db();
  if (!p) return [];
  const { rows } = await p.query<RecipeRow>(
    `SELECT id, title, category,
            COALESCE(array_length(ingredients,1),0) AS ingredient_count,
            COALESCE(array_length(steps,1),0)       AS step_count
       FROM recipes
      ORDER BY (category = 'especial') DESC, title ASC`
  );
  return rows;
}

export async function getRecipe(id: number): Promise<RecipeRow | null> {
  const p = db();
  if (!p) return null;
  const { rows } = await p.query<RecipeRow>(
    `SELECT id, title, category, ingredients, steps, body FROM recipes WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createRecipe(input: {
  title: string; category?: string; ingredients?: string[];
  steps?: string[]; body?: unknown; notion_id?: string | null;
}): Promise<RecipeRow> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rows } = await p.query<RecipeRow>(
    `INSERT INTO recipes (title, category, ingredients, steps, body, notion_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, title, category`,
    [
      input.title, input.category ?? "diaria",
      input.ingredients ?? [], input.steps ?? [],
      JSON.stringify(input.body ?? []), input.notion_id ?? null,
    ]
  );
  return rows[0];
}

export type Plant = {
  id: number; name: string; location: string | null; care: string | null; image_url: string | null;
};

export async function listPlants(): Promise<Plant[]> {
  const p = db();
  if (!p) return [];
  const { rows } = await p.query<Plant>(
    `SELECT id, name, location, care, image_url FROM plants ORDER BY id ASC`
  );
  return rows;
}

export async function createPlant(input: {
  name: string; location?: string | null; care?: string | null; image_url?: string | null;
}): Promise<Plant> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rows } = await p.query<Plant>(
    `INSERT INTO plants (name, location, care, image_url) VALUES ($1,$2,$3,$4)
     RETURNING id, name, location, care, image_url`,
    [input.name, input.location ?? null, input.care ?? null, input.image_url ?? null]
  );
  return rows[0];
}

// Partial update: only the keys present in `patch` are written, so callers can
// change one field without resending the whole row.
export async function updatePlant(
  id: number,
  patch: { name?: string | null; location?: string | null; care?: string | null; image_url?: string | null }
): Promise<Plant | null> {
  const p = db();
  if (!p) throw new Error("no database");
  const cols = ["name", "location", "care", "image_url"] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const col of cols) {
    if (col in patch) {
      vals.push(patch[col] ?? null);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) return null;
  vals.push(id);
  const { rows } = await p.query<Plant>(
    `UPDATE plants SET ${sets.join(", ")} WHERE id = $${vals.length}
     RETURNING id, name, location, care, image_url`,
    vals
  );
  return rows[0] ?? null;
}

export type AirFryerRow = {
  id: number;
  ingredient: string;
  servings: number;
  minutes: number | null;
  temp_f: number | null;
  // Which Ninja function to press: Air Fry, Air Broil, Roast, Bake, Reheat,
  // Dehydrate. Null for rows that predate the column.
  mode: string | null;
  note: string | null;
};

export async function listAirFryer(): Promise<AirFryerRow[]> {
  const p = db();
  if (!p) return [];
  const { rows } = await p.query<AirFryerRow>(
    `SELECT id, ingredient, servings, minutes, temp_f, mode, note
       FROM air_fryer
      ORDER BY lower(ingredient) ASC, servings ASC`
  );
  return rows;
}

export async function createAirFryer(input: {
  ingredient: string;
  servings: number;
  minutes?: number | null;
  temp_f?: number | null;
  mode?: string | null;
  note?: string | null;
}): Promise<AirFryerRow> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rows } = await p.query<AirFryerRow>(
    `INSERT INTO air_fryer (ingredient, servings, minutes, temp_f, mode, note)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, ingredient, servings, minutes, temp_f, mode, note`,
    [input.ingredient, input.servings, input.minutes ?? null, input.temp_f ?? null, input.mode ?? null, input.note ?? null]
  );
  return rows[0];
}

export async function updateAirFryer(
  id: number,
  patch: Partial<Omit<AirFryerRow, "id">>
): Promise<AirFryerRow | null> {
  const p = db();
  if (!p) throw new Error("no database");
  const cols = ["ingredient", "servings", "minutes", "temp_f", "mode", "note"] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const col of cols) {
    if (col in patch) {
      vals.push(patch[col] ?? null);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) return null;
  vals.push(id);
  const { rows } = await p.query<AirFryerRow>(
    `UPDATE air_fryer SET ${sets.join(", ")} WHERE id = $${vals.length}
     RETURNING id, ingredient, servings, minutes, temp_f, mode, note`,
    vals
  );
  return rows[0] ?? null;
}

export async function deleteAirFryer(id: number): Promise<boolean> {
  const p = db();
  if (!p) throw new Error("no database");
  const r = await p.query(`DELETE FROM air_fryer WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export type Document = {
  id: number;
  country: string | null;
  doc_type: string | null;
  number: string | null;
  issued_on: string | null;
  expires_on: string | null;
  owner: string | null;
  file_url: string | null;
  note: string | null;
};

export async function listDocuments(): Promise<Document[]> {
  const p = db();
  if (!p) return [];
  const { rows } = await p.query<Document>(
    `SELECT id, country, doc_type, number, issued_on, expires_on, owner, file_url, note
       FROM documents
      ORDER BY (expires_on IS NULL), expires_on ASC`
  );
  return rows;
}

export async function getDocument(id: number): Promise<Document | null> {
  const p = db();
  if (!p) return null;
  const { rows } = await p.query<Document>(
    `SELECT id, country, doc_type, number, issued_on, expires_on, owner, file_url, note
       FROM documents WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateDocument(
  id: number,
  patch: Partial<Omit<Document, "id">>
): Promise<Document | null> {
  const p = db();
  if (!p) throw new Error("no database");
  const cols = ["country", "doc_type", "number", "issued_on", "expires_on", "owner", "file_url", "note"] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const col of cols) {
    if (col in patch) {
      vals.push(patch[col] ?? null);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) return null;
  vals.push(id);
  const { rows } = await p.query<Document>(
    `UPDATE documents SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function deleteDocument(id: number): Promise<boolean> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rowCount } = await p.query(`DELETE FROM documents WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function createDocument(input: {
  country?: string | null;
  doc_type?: string | null;
  number?: string | null;
  issued_on?: string | null;
  expires_on?: string | null;
  owner?: string | null;
  file_url?: string | null;
  note?: string | null;
}): Promise<Document> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rows } = await p.query<Document>(
    `INSERT INTO documents (country, doc_type, number, issued_on, expires_on, owner, file_url, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      input.country ?? null, input.doc_type ?? null, input.number ?? null,
      input.issued_on ?? null, input.expires_on ?? null, input.owner ?? null,
      input.file_url ?? null, input.note ?? null,
    ]
  );
  return rows[0];
}

export async function listItems(opts: { includeDone?: boolean } = {}): Promise<Item[]> {
  const p = db();
  if (!p) return [];
  const where = opts.includeDone ? "" : "WHERE done = false";
  const { rows } = await p.query<Item>(
    `SELECT * FROM items ${where}
     ORDER BY (due_at IS NULL), due_at ASC, created_at DESC
     LIMIT 200`
  );
  return rows;
}

const KINDS: Kind[] = ["task", "note", "event", "shop"];

export function isKind(v: unknown): v is Kind {
  return typeof v === "string" && (KINDS as string[]).includes(v);
}

export async function createItem(input: {
  kind: Kind;
  title: string;
  detail?: string | null;
  who?: string | null;
  due_at?: string | null;
  created_by: string;
}): Promise<Item> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rows } = await p.query<Item>(
    `INSERT INTO items (kind, title, detail, who, due_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      input.kind,
      input.title,
      input.detail ?? null,
      input.who ?? null,
      input.due_at ?? null,
      input.created_by,
    ]
  );
  return rows[0];
}

export async function updateItem(
  id: number,
  patch: { done?: boolean; title?: string; detail?: string | null }
): Promise<Item | null> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rows } = await p.query<Item>(
    `UPDATE items SET
       done       = COALESCE($2, done),
       title      = COALESCE($3, title),
       detail     = COALESCE($4, detail),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, patch.done ?? null, patch.title ?? null, patch.detail ?? null]
  );
  return rows[0] ?? null;
}

export async function deleteItem(id: number): Promise<boolean> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rowCount } = await p.query(`DELETE FROM items WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

// The six functions on the Ninja DoubleStack XL 2-basket (SL401). The order
// matches the panel so the UI can render them as-is.
export const AIR_FRYER_MODES = [
  "Air Fry",
  "Air Broil",
  "Roast",
  "Bake",
  "Reheat",
  "Dehydrate",
] as const;
