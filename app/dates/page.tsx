import { ensureSchema, listMoments } from "../../lib/db";
import MomentsEditor from "../../components/MomentsEditor";
import Shell from "../../components/Shell";

export const dynamic = "force-dynamic";

export default async function DatesPage() {
  await ensureSchema();
  const moments = await listMoments();

  return (
    <div className="shell">
      <Shell active="dates" />

      <div style={{ maxWidth: 1080 }}>
        <div className="sechead">
          <h2>Fechas que no se olvidan</h2>
          <span className="count">{moments.length}</span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--mute)" }}>
          Cumpleaños, aniversarios y fechas que importan. Las que se repiten todos los años no
          necesitan año. Cuando falta una semana aparecen en la pared, arriba.
        </p>
        <MomentsEditor initial={moments} />
      </div>
    </div>
  );
}
