import { ensureSchema, listAirFryer } from "../../lib/db";
import AirFryerPanel from "../../components/AirFryerPanel";
import Shell from "../../components/Shell";

export const dynamic = "force-dynamic";

export default async function AirFryerPage() {
  await ensureSchema();
  const rows = await listAirFryer();

  return (
    <div className="shell">
      <Shell active="air-fryer" />

      <div style={{ maxWidth: 980 }}>
        <div className="sechead">
          <h2>Air Fryer</h2>
          <span className="count">{rows.length}</span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--mute)" }}>
          Ingrediente, modo, porción, tiempo y temperatura en °F.
        </p>
        <AirFryerPanel initial={rows} />
      </div>
    </div>
  );
}
