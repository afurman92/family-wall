import { ensureSchema, listTrash, TRASH_DAYS } from "../../lib/db";
import Shell from "../../components/Shell";
import TrashList from "../../components/TrashList";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  await ensureSchema();
  const rows = await listTrash();

  return (
    <div className="shell">
      <Shell active="trash" />
      <div style={{ maxWidth: 920 }}>
        <div className="sechead">
          <h2>Papelera</h2>
          <span className="count">{rows.length}</span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--mute)" }}>
          Nada de acá se borró de verdad. Restaurá lo que haga falta; lo que quede más de {TRASH_DAYS} días
          se va solo. Vaciar la papelera es cosa de ustedes: los agentes pueden restaurar, no destruir.
        </p>
        <TrashList initial={rows} />
      </div>
    </div>
  );
}
