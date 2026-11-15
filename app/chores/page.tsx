import { ensureSchema, listChores } from "../../lib/db";
import ChoresEditor from "../../components/ChoresEditor";
import Shell from "../../components/Shell";

export const dynamic = "force-dynamic";

export default async function ChoresPage() {
  await ensureSchema();
  const chores = await listChores();

  return (
    <div className="shell">
      <Shell active="chores" />

      <div style={{ maxWidth: 1080 }}>
        <div className="sechead">
          <h2>Chores</h2>
          <span className="count">{chores.length}</span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--mute)" }}>
          Assign to a person and a part of the day. They show up on the wall in that person&apos;s
          lane, and &ldquo;done&rdquo; resets every morning.
        </p>
        <ChoresEditor initial={chores} />
      </div>
    </div>
  );
}
