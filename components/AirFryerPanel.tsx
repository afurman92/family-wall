"use client";

import { useState } from "react";

export type AirFryerRow = {
  id: number;
  ingredient: string;
  servings: number;
  minutes: number | null;
  temp_f: number | null;
  mode: string | null;
  note: string | null;
};

// The six functions on the Ninja DoubleStack XL 2-basket.
const MODES = ["Air Fry", "Air Broil", "Roast", "Bake", "Reheat", "Dehydrate"];

const field: React.CSSProperties = {
  font: "inherit",
  fontSize: 16,
  padding: "10px 12px",
  border: "1px solid #D6CFC0",
  borderRadius: 10,
  background: "#FBF9F4",
  color: "#111111",
  width: "100%",
  minWidth: 0,
};

const head: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#7A756B",
};

function sortRows(rows: AirFryerRow[]): AirFryerRow[] {
  return [...rows].sort((a, b) => {
    const n = a.ingredient.localeCompare(b.ingredient, "es", { sensitivity: "base" });
    return n !== 0 ? n : a.servings - b.servings;
  });
}

export default function AirFryerPanel({ initial }: { initial: AirFryerRow[] }) {
  const [rows, setRows] = useState<AirFryerRow[]>(sortRows(initial));
  const [ingredient, setIngredient] = useState("");
  const [servings, setServings] = useState(2);
  const [mode, setMode] = useState("Air Fry");
  const [minutes, setMinutes] = useState("");
  const [temp, setTemp] = useState("400");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!ingredient.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/air-fryer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient: ingredient.trim(),
          servings,
          mode,
          minutes: minutes === "" ? null : Number(minutes),
          temp_f: temp === "" ? null : Number(temp),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "No se pudo guardar");
      setRows((prev) => sortRows([...prev, j.row as AirFryerRow]));
      setIngredient("");
      setMinutes("");
      // temp and servings stay: usually several items share the same setting
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const before = rows;
    setRows((prev) => prev.filter((r) => r.id !== id));
    const res = await fetch(`/api/air-fryer/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setRows(before);
      setError("No se pudo borrar");
    }
  }

  return (
    <div>
      <form onSubmit={add} className="af-form">
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Ingrediente</span>
          <input
            style={field}
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value)}
            placeholder="Papas en bastones"
            maxLength={120}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Modo</span>
          <select style={field} value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Porción</span>
          <select
            style={field}
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Minutos</span>
          <input
            style={field}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            placeholder="18"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Temp °F</span>
          <input
            style={field}
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            inputMode="numeric"
            placeholder="400"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !ingredient.trim()}
          style={{
            font: "inherit",
            fontSize: 15,
            fontWeight: 700,
            padding: "11px 20px",
            borderRadius: 10,
            border: "none",
            background: "#111111",
            color: "#F2EEE6",
            cursor: busy || !ingredient.trim() ? "default" : "pointer",
            opacity: busy || !ingredient.trim() ? 0.4 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {busy ? "…" : "Agregar"}
        </button>
      </form>

      {error && <div style={{ color: "#E5261E", marginBottom: 12, fontSize: 14 }}>{error}</div>}

      {rows.length === 0 ? (
        <div className="empty">Todavía no hay datos. Agregá el primero arriba.</div>
      ) : (
        <div>
          <div className="af-thead">
            <span style={head}>Ingrediente</span>
            <span style={head}>Modo</span>
            <span style={head}>Porción</span>
            <span style={head}>Tiempo</span>
            <span style={head}>Temp</span>
            <span />
          </div>
          {rows.map((r) => (
            <div key={r.id} className="af-row2">
              <span className="af-ing" style={{ fontSize: 16.5 }}>
                {r.ingredient}
                {r.note ? (
                  <span style={{ display: "block", fontSize: 12.5, color: "#7A756B", marginTop: 2, lineHeight: 1.35 }}>
                    {r.note}
                  </span>
                ) : null}
              </span>
              <span className="af-cell" data-label="Modo" style={{ fontSize: 15, color: "#3B3934", fontWeight: 600 }}>{r.mode || "—"}</span>
              <span className="af-cell" data-label="Porción" style={{ fontSize: 16, color: "#7A756B" }}>{r.servings}</span>
              <span className="af-cell" data-label="Tiempo" style={{ fontSize: 16, color: "#7A756B" }}>
                {r.minutes != null ? `${r.minutes} min` : "—"}
              </span>
              <span className="af-cell" data-label="Temp" style={{ fontSize: 16, color: "#7A756B" }}>
                {r.temp_f != null ? `${r.temp_f}°F` : "—"}
              </span>
              <button
                className="af-del"
                onClick={() => remove(r.id)}
                aria-label={`Borrar ${r.ingredient}`}
                style={{
                  font: "inherit",
                  fontSize: 15,
                  lineHeight: 1,
                  border: "none",
                  background: "transparent",
                  color: "#7A756B",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
