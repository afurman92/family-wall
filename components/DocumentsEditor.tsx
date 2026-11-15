"use client";

import { useState } from "react";

export type Doc = {
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

// pg can hand these back as Date or as "YYYY-MM-DD"; both have to work.
function dstr(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

function daysLeft(expires: string | null): number | null {
  const d = dstr(expires);
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  const then = new Date(y, m - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((then.getTime() - today.getTime()) / 86400000);
}

function expiryLabel(expires: string | null) {
  const n = daysLeft(expires);
  if (n === null) return { text: "—", color: "#7A756B", weight: 500 };
  if (n < 0) return { text: "vencido", sub: `hace ${Math.abs(n)} d`, color: "#B42318", weight: 800 };
  if (n <= 90) return { text: `${n} d`, color: "#B4740A", weight: 800 };
  return { text: `${n} d`, color: "#3B3934", weight: 600 };
}

const blank = {
  country: "",
  doc_type: "",
  number: "",
  issued_on: "",
  expires_on: "",
  owner: "",
  note: "",
};

export default function DocumentsEditor({ initial }: { initial: Doc[] }) {
  const [docs, setDocs] = useState<Doc[]>(initial);
  const [form, setForm] = useState({ ...blank });
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setD = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((f) => ({ ...f, [k]: e.target.value }));

  function sort(list: Doc[]) {
    return [...list].sort((a, b) => {
      const da = dstr(a.expires_on) || "9999-12-31";
      const db = dstr(b.expires_on) || "9999-12-31";
      return da === db ? (a.country || "").localeCompare(b.country || "") : da.localeCompare(db);
    });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!form.country.trim() && !form.doc_type.trim()) {
      setError("Poné al menos el país o el tipo de documento.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: form.country || null,
          doc_type: form.doc_type || null,
          number: form.number || null,
          issued_on: form.issued_on || null,
          expires_on: form.expires_on || null,
          owner: form.owner || null,
          note: form.note || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "no se pudo guardar");
      setDocs((prev) => sort([...prev, j.document]));
      setForm({ ...blank });
      setStatus("Documento agregado. Ahora podés subir el escaneo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(d: Doc) {
    setEditing(d.id);
    setError(null);
    setStatus(null);
    setDraft({
      country: d.country || "",
      doc_type: d.doc_type || "",
      number: d.number || "",
      issued_on: dstr(d.issued_on),
      expires_on: dstr(d.expires_on),
      owner: d.owner || "",
      note: d.note || "",
    });
  }

  async function saveEdit(id: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: draft.country || null,
          doc_type: draft.doc_type || null,
          number: draft.number || null,
          issued_on: draft.issued_on || null,
          expires_on: draft.expires_on || null,
          owner: draft.owner || null,
          note: draft.note || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "no se pudo guardar");
      setDocs((prev) => sort(prev.map((d) => (d.id === id ? { ...d, ...j.document } : d))));
      setEditing(null);
      setStatus("Guardado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, label: string) {
    if (!confirm(`¿Borrar ${label}? Esta acción no se puede deshacer.`)) return;
    setError(null);
    const before = docs;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setDocs(before);
      setError("No se pudo borrar.");
    }
  }

  async function upload(id: number, file: File) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/documents/${id}/file`, { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "no se pudo subir");
      setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...j.document } : d)));
      setStatus("Escaneo subido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo subir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={add} className="doc-form">
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>País</span>
          <input style={field} value={form.country} onChange={set("country")} placeholder="Canadá" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Tipo</span>
          <input style={field} value={form.doc_type} onChange={set("doc_type")} placeholder="Pasaporte" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Número</span>
          <input style={field} value={form.number} onChange={set("number")} placeholder="AB123456" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Vence</span>
          <input style={field} type="date" value={form.expires_on} onChange={set("expires_on")} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Dueño</span>
          <input style={field} value={form.owner} onChange={set("owner")} placeholder="alex" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={head}>Nota</span>
          <input style={field} value={form.note} onChange={set("note")} placeholder="Opcional" />
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{
            font: "inherit",
            fontSize: 15,
            fontWeight: 700,
            padding: "11px 20px",
            borderRadius: 10,
            border: "none",
            background: "#111111",
            color: "#F2EEE6",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.4 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {busy ? "…" : "Agregar"}
        </button>
      </form>

      {error && <div style={{ color: "#B42318", marginBottom: 10, fontSize: 14 }}>{error}</div>}
      {status && <div style={{ color: "#1C7A56", marginBottom: 10, fontSize: 14 }}>{status}</div>}

      {docs.length === 0 ? (
        <div className="empty">Todavía no hay documentos.</div>
      ) : (
        <div>
          <div className="doc-head">
            <span style={head}>Documento</span>
            <span style={head}>Número</span>
            <span style={head}>Vence</span>
            <span style={head}>Dueño</span>
            <span style={head}>Escaneo</span>
            <span />
          </div>

          {docs.map((d) => {
            const exp = expiryLabel(d.expires_on);
            const label = [d.country, d.doc_type].filter(Boolean).join(" · ") || `#${d.id}`;
            const isEditing = editing === d.id;

            if (isEditing) {
              return (
                <div key={d.id} className="doc-row doc-row--edit">
                  <div className="doc-grid">
                    <input style={field} value={draft.country} onChange={setD("country")} placeholder="País" />
                    <input style={field} value={draft.doc_type} onChange={setD("doc_type")} placeholder="Tipo" />
                    <input style={field} value={draft.number} onChange={setD("number")} placeholder="Número" />
                    <input style={field} type="date" value={draft.expires_on} onChange={setD("expires_on")} />
                    <input style={field} value={draft.owner} onChange={setD("owner")} placeholder="Dueño" />
                    <input style={field} value={draft.note} onChange={setD("note")} placeholder="Nota" />
                  </div>
                  <div className="doc-actions">
                    <button className="btn btn--solid" onClick={() => saveEdit(d.id)} disabled={busy}>
                      Guardar
                    </button>
                    <button className="btn" onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={d.id} className="doc-row">
                <span className="doc-name">
                  <b>{label}</b>
                  {d.note ? <small>{d.note}</small> : null}
                </span>
                <span className="doc-cell" data-label="Número">
                  {d.number || "—"}
                </span>
                <span className="doc-cell" data-label="Vence" style={{ color: exp.color, fontWeight: exp.weight }}>
                  {exp.text}
                  {"sub" in exp && exp.sub ? <small>{exp.sub}</small> : null}
                </span>
                <span className="doc-cell" data-label="Dueño">
                  {d.owner || "—"}
                </span>
                <span className="doc-cell" data-label="Escaneo">
                  {d.file_url ? (
                    <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer">
                      abrir
                    </a>
                  ) : (
                    <span style={{ color: "#7A756B" }}>sin archivo</span>
                  )}
                </span>
                <span className="doc-actions">
                  <label className="doc-upload">
                    {d.file_url ? "Reemplazar" : "Subir"}
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) upload(d.id, f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button className="btn btn--ghost" onClick={() => startEdit(d)}>
                    Editar
                  </button>
                  <button className="btn btn--ghost" onClick={() => remove(d.id, label)} aria-label={`Borrar ${label}`}>
                    ✕
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
