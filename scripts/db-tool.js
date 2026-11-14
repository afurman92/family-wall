const fs = require("fs");
const { Pool } = require("pg");

function loadEnv(p) {
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv(".env.local");
const url = env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL;
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

(async () => {
  const cmd = process.argv[2] || "list";
  if (cmd === "list") {
    const r = await pool.query("SELECT id,name,location,care,image_url FROM plants ORDER BY id");
    r.rows.forEach((x) =>
      console.log(`${x.id} | ${x.name} | ${x.location} | ${x.care} | ${(x.image_url || "").slice(0, 55)}`)
    );
  } else if (cmd === "rehost") {
    const r = await pool.query(
      "UPDATE plants SET image_url = '/plants/plant-' || id || '.jpg' WHERE id BETWEEN 1 AND 8 RETURNING id, image_url"
    );
    console.log("updated:", r.rowCount);
    r.rows.forEach((x) => console.log(`  ${x.id} -> ${x.image_url}`));
  } else if (cmd === "counts") {
    for (const t of ["plants", "recipes", "items", "documents"]) {
      const r = await pool.query(`SELECT count(*)::int c FROM ${t}`);
      console.log(`${t}: ${r.rows[0].c}`);
    }
    const k = await pool.query("SELECT kind, count(*)::int c FROM items GROUP BY kind ORDER BY kind");
    k.rows.forEach((x) => console.log(`  ${x.kind}: ${x.c}`));
  }
  await pool.end();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
