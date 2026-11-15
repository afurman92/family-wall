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
  // e.g. FAMILIA_POSTGRES_URL. Accept any such prefix, but avoid the
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

  // Dates the house must not forget. Birthdays and anniversaries repeat yearly,
  // so they are stored as month + day and never expire; one-off dates keep a
  // full date. Kept here rather than in the calendar so they can't be duplicated
  // with the birthdays Google already knows about.
  await p.query(`
    CREATE TABLE IF NOT EXISTS moments (
      id           BIGSERIAL PRIMARY KEY,
      title        TEXT NOT NULL,
      kind         TEXT NOT NULL DEFAULT 'birthday' CHECK (kind IN ('birthday','anniversary','other')),
      month        SMALLINT,
      day          SMALLINT,
      on_date      DATE,
      who          TEXT NOT NULL DEFAULT 'any',
      created_by   TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (month IS NOT NULL OR on_date IS NOT NULL)
    )
  `);
  // Optional birth year: without it a birthday is just a date; with it the wall
  // can say "turns 35", and an anniversary "12 years".
  await p.query(`ALTER TABLE moments ADD COLUMN IF NOT EXISTS year SMALLINT`);

  // Recipes carried over from Notion. `body` keeps the original block
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

  // Chores are their own thing: they repeat, they belong to a person AND a part
  // of the day, and "done" resets every morning. An item does none of that.
  await p.query(`
    CREATE TABLE IF NOT EXISTS chores (
      id          BIGSERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      who         TEXT NOT NULL DEFAULT 'any',
      routine     TEXT NOT NULL DEFAULT 'any' CHECK (routine IN ('morning','after','evening','any')),
      emoji       TEXT,
      done_on     DATE,
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS chores_who_idx ON chores (who, routine)`);
  // daily | weekly | monthly. A chore is "done" for its whole period, not just today.
  await p.query(`ALTER TABLE chores ADD COLUMN IF NOT EXISTS freq TEXT NOT NULL DEFAULT 'daily'`);

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

// ---------------------------------------------------------------- chores
export type Chore = {
  id: number;
  title: string;
  who: string;
  routine: "morning" | "after" | "evening" | "any";
  freq: "daily" | "weekly" | "biweekly" | "monthly";
  emoji: string | null;
  done_on: string | null;
  done: boolean;
  created_by: string;
  created_at: string;
};

export async function listChores(): Promise<Chore[]> {
  const p = db();
  if (!p) return [];
  const { rows } = await p.query<Chore>(
    `SELECT id, title, who, routine, freq, emoji, done_on,
            (done_on IS NOT NULL AND done_on >= CASE freq
                WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE)::date
                WHEN 'biweekly' THEN (CURRENT_DATE - 13)
                WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::date
                ELSE CURRENT_DATE END) AS done,
            created_by, created_at
       FROM chores
      ORDER BY who, routine, lower(title)`
  );
  return rows;
}

export async function createChore(input: {
  title: string;
  who?: string | null;
  routine?: string | null;
  freq?: string | null;
  emoji?: string | null;
  created_by: string;
}): Promise<Chore> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rows } = await p.query<Chore>(
    `INSERT INTO chores (title, who, routine, freq, emoji, created_by)
     VALUES ($1, COALESCE($2,'any'), COALESCE($3,'any'), COALESCE($4,'daily'), $5, $6)
     RETURNING id, title, who, routine, freq, emoji, done_on, false AS done, created_by, created_at`,
    [input.title, input.who ?? null, input.routine ?? null, input.freq ?? null, input.emoji ?? null, input.created_by]
  );
  return rows[0];
}

export async function updateChore(
  id: number,
  patch: { title?: string; who?: string; routine?: string; freq?: string; done?: boolean }
): Promise<Chore | null> {
  const p = db();
  if (!p) throw new Error("no database");
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.title !== undefined) { sets.push(`title = $${sets.length + 1}`); vals.push(patch.title); }
  if (patch.who !== undefined) { sets.push(`who = $${sets.length + 1}`); vals.push(patch.who); }
  if (patch.routine !== undefined) { sets.push(`routine = $${sets.length + 1}`); vals.push(patch.routine); }
  if (patch.freq !== undefined) { sets.push(`freq = $${sets.length + 1}`); vals.push(patch.freq); }
  if (patch.done !== undefined) {
    sets.push(patch.done ? `done_on = CURRENT_DATE` : `done_on = NULL`);
  }
  if (!sets.length) return null;
  vals.push(id);
  // id is always the last parameter: `done` adds a SET clause with no value of
  // its own, so counting SET clauses would misalign the placeholders.
  const { rows } = await p.query<Chore>(
    `UPDATE chores SET ${sets.join(", ")} WHERE id = $${vals.length}
     RETURNING id, title, who, routine, freq, emoji, done_on,
               (done_on IS NOT NULL AND done_on >= CASE freq
                   WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE)::date
                   WHEN 'biweekly' THEN (CURRENT_DATE - 13)
                WHEN 'biweekly' THEN (CURRENT_DATE - 13)
                   WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::date
                   ELSE CURRENT_DATE END) AS done, created_by, created_at`,
    vals
  );
  return rows[0] ?? null;
}

export async function deleteChore(id: number): Promise<boolean> {
  const p = db();
  if (!p) throw new Error("no database");
  const { rowCount } = await p.query(`DELETE FROM chores WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

// Documents whose expiry has passed or is close. The wall needs the numbers,
// not the records: days_left is negative once expired.
export type ExpiringDoc = {
  id: number;
  country: string;
  doc_type: string;
  owner: string | null;
  expires_on: string;
  days_left: number;
};

export async function expiringDocuments(withinDays = 90): Promise<ExpiringDoc[]> {
  const p = db();
  if (!p) return [];
  const { rows } = await p.query<ExpiringDoc>(
    `SELECT id, country, doc_type, owner, expires_on,
            (expires_on - CURRENT_DATE) AS days_left
       FROM documents
      WHERE expires_on IS NOT NULL
        AND expires_on <= CURRENT_DATE + $1::int
      ORDER BY expires_on ASC`,
    [withinDays]
  );
  return rows.map((r) => ({ ...r, days_left: Number(r.days_left) }));
}

// ---------------------------------------------------------------- moments

export type Moment = {
  id: number;
  title: string;
  kind: "birthday" | "anniversary" | "other";
  month: number | null;
  day: number | null;
  year: number | null;
  on_date: string | null;
  who: string;
  created_by: string;
  created_at: string;
};

// Days until the next occurrence. Yearly dates wrap: a birthday on Jan 3 is 350
// days away in February, not -40.
export type UpcomingMoment = Moment & { days_left: number; in_year: number; age: number | null };

export async function listMoments(): Promise<Moment[]> {
  const p = db();
  if (!p) return [];
  const { rows } = await p.query<Moment>(
    `SELECT id, title, kind, month, day, year,
            to_char(on_date,'YYYY-MM-DD') AS on_date, who, created_by, created_at
       FROM moments
      ORDER BY COALESCE(month, 0), COALESCE(day, 0), on_date`
  );
  return rows;
}

export async function createMoment(m: {
  title: string;
  kind?: string;
  month?: number | null;
  day?: number | null;
  on_date?: string | null;
  year?: number | null;
  who?: string;
  created_by: string;
}): Promise<Moment | null> {
  const p = db();
  if (!p) return null;
  const { rows } = await p.query<Moment>(
    `INSERT INTO moments (title, kind, month, day, on_date, who, created_by, year)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,'any'),$7,$8)
     RETURNING id, title, kind, month, day, year, to_char(on_date,'YYYY-MM-DD') AS on_date, who, created_by, created_at`,
    [m.title, m.kind || "birthday", m.month ?? null, m.day ?? null, m.on_date ?? null, m.who || null, m.created_by, m.year ?? null]
  );
  return rows[0] ?? null;
}

export async function updateMoment(
  id: number,
  patch: Partial<Pick<Moment, "title" | "kind" | "month" | "day" | "year" | "on_date" | "who">>
): Promise<Moment | null> {
  const p = db();
  if (!p) return null;
  const sets: string[] = [];
  const vals: any[] = [];
  const put = (col: string, v: any) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (patch.title !== undefined) put("title", patch.title);
  if (patch.kind !== undefined) put("kind", patch.kind);
  if (patch.month !== undefined) put("month", patch.month);
  if (patch.day !== undefined) put("day", patch.day);
  if (patch.year !== undefined) put("year", patch.year);
  if (patch.on_date !== undefined) put("on_date", patch.on_date);
  if (patch.who !== undefined) put("who", patch.who);
  if (!sets.length) return null;
  vals.push(id);
  const { rows } = await p.query<Moment>(
    `UPDATE moments SET ${sets.join(", ")} WHERE id = $${vals.length}
     RETURNING id, title, kind, month, day, year, to_char(on_date,'YYYY-MM-DD') AS on_date, who, created_by, created_at`,
    vals
  );
  return rows[0] ?? null;
}

export async function deleteMoment(id: number): Promise<boolean> {
  const p = db();
  if (!p) return false;
  const { rowCount } = await p.query(`DELETE FROM moments WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

// Next occurrences inside the window. The day arithmetic happens in Postgres so
// the "today" is the same one the rest of the app uses.
export async function upcomingMoments(withinDays = 30): Promise<UpcomingMoment[]> {
  const p = db();
  if (!p) return [];
  const { rows } = await p.query<UpcomingMoment>(
    `WITH next_day AS (
       SELECT m.*,
              CASE WHEN m.on_date IS NOT NULL THEN m.on_date
                   ELSE make_date(
                     EXTRACT(YEAR FROM CURRENT_DATE)::int
                       + CASE WHEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, m.month, m.day) < CURRENT_DATE
                              THEN 1 ELSE 0 END,
                     m.month, m.day)
              END AS next_on
         FROM moments m
     )
     SELECT id, title, kind, month, day, year,
            to_char(on_date,'YYYY-MM-DD') AS on_date, who, created_by, created_at,
            (next_on - CURRENT_DATE) AS days_left,
            EXTRACT(YEAR FROM next_on)::int AS in_year,
            CASE WHEN year IS NOT NULL THEN EXTRACT(YEAR FROM next_on)::int - year END AS age
       FROM next_day
      WHERE (next_on - CURRENT_DATE) BETWEEN 0 AND $1::int
      ORDER BY next_on ASC`,
    [withinDays]
  );
  return rows.map((r) => ({
    ...r,
    days_left: Number(r.days_left),
    in_year: Number(r.in_year),
    age: r.age === null || r.age === undefined ? null : Number(r.age),
  }));
}
