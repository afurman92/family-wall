"use client";

import { useState } from "react";

export type TrashItem = {
  table: string;
  id: number;
  title: string;
  deleted_at: string;
  deleted_by: string | null;
};

const LABEL: Record<string, string> = {
  items: "To do / Shopping",
  chores: "Chores",
  moments: "Fechas",
  air_fryer: "Air Fryer",
  documents: "Documentos",
};

const WHEN: Record<string, string> = {
  items: "Ítems",
  chores: "Chores",
  moments: "Fechas",
  air_fryer: "Air Fryer",
  documents: "Documentos",
};

function ago(iso: string) {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export default function TrashList({ initial }: { initial: TrashItem[] }) {
  const [rows, setRows] = useState<TrashItem[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(row: TrashItem, action: "restore" | "purge") {
    const key = `${row.table}-${row.id}`;
    if (action === "purge" && !confirm(`¿Borrar "${row.title}" para siempre? Esto no se deshace.`)) return;
    setBusy(key);
    const res = await fetch("/api/trash", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ table: row.table, id: row.id, action }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || `No se pudo (HTTP ${res.status}).`);
      return;
    }
    setErr(null);
    setRows((prev) => prev.filter((r) => !(r.table === row.table && r.id === row.id)));
  }

  if (!rows.length) {
    return (
      <div className="empty">
        La papelera está vacía. Lo que borres aparece acá durante 30 días.
      </div>
    );
  }

  const groups = Object.keys(LABEL).filter((t) => rows.some((r) => r.table === t));

  return (
    <div>
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      {groups.map((table) => (
        <div key={table} style={{ marginBottom: 26 }}>
          <div className="sechead">
            <h3 style={{ fontSize: 15, margin: 0 }}>{LABEL[table]}</h3>
            <span className="count">{rows.filter((r) => r.table === table).length}</span>
          </div>
          {rows
            .filter((r) => r.table === table)
            .map((r) => (
              <div className="item trash-row" key={`${r.table}-${r.id}`}>
                <div className="body">
                  <div className="title">{r.title}</div>
                  <div className="meta">
                    <span>borrado {ago(r.deleted_at)}</span>
                    {r.deleted_by && (
                      <>
                        <span>·</span>
                        <span>por {r.deleted_by}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  className="btn-quiet"
                  onClick={() => act(r, "restore")}
                  disabled={busy === `${r.table}-${r.id}`}
                >
                  Restaurar
                </button>
                <button
                  className="del"
                  onClick={() => act(r, "purge")}
                  disabled={busy === `${r.table}-${r.id}`}
                  title="Borrar para siempre"
                  aria-label="Borrar para siempre"
                >
                  ✕
                </button>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
