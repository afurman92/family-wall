"use client";

import { useMemo, useState } from "react";

type Moment = {
  id: number;
  title: string;
  kind: "birthday" | "anniversary" | "other";
  month: number | null;
  day: number | null;
  year: number | null;
  note: string | null;
  on_date: string | null;
  who: string;
  created_by: string;
};

const KINDS: { id: Moment["kind"]; label: string; emoji: string }[] = [
  { id: "birthday", label: "Cumpleaños", emoji: "🎂" },
  { id: "anniversary", label: "Aniversario", emoji: "💛" },
  { id: "other", label: "Otra fecha", emoji: "📌" },
];

const WHO = [
  { id: "any", label: "De los dos" },
  { id: "alex", label: "Alex" },
  { id: "jordan", label: "Jordan" },
];

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Age at the next occurrence: a birthday "turns 35", an anniversary "12 years".
function milestone(m: { kind: string; month: number | null; day: number | null; year: number | null }) {
  if (!m.year) return null;
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), (m.month || 1) - 1, m.day || 1);
  const nextYear = thisYear < now ? now.getFullYear() + 1 : now.getFullYear();
  const n = nextYear - m.year;
  if (n <= 0) return null;
  return m.kind === "anniversary" ? `${n} años` : `cumple ${n}`;
}

function label(m: Moment) {
  if (m.on_date) {
    const [y, mo, d] = m.on_date.split("-").map(Number);
    return `${d} de ${MONTHS[mo - 1]} de ${y}`;
  }
  return `${m.day} de ${MONTHS[(m.month || 1) - 1]}${m.year ? " de " + m.year : ""}`;
}

// Months and days mixed into one sortable key: what the house reads calendar-wise.
function key(m: Moment) {
  if (m.on_date) return m.on_date;
  return `1900-${String(m.month).padStart(2, "0")}-${String(m.day).padStart(2, "0")}`;
}

function draftOf(m: Moment) {
  return {
    title: m.title,
    kind: m.kind,
    yearly: !m.on_date,
    month: String(m.month || 1),
    day: m.day ? String(m.day) : "",
    year: m.year ? String(m.year) : "",
    on_date: m.on_date || "",
    who: m.who || "any",
    note: m.note || "",
  };
}

export default function MomentsEditor({ initial }: { initial: Moment[] }) {
  const [rows, setRows] = useState<Moment[]>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // what is being added
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Moment["kind"]>("birthday");
  const [yearly, setYearly] = useState(true);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [day, setDay] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [onDate, setOnDate] = useState("");
  const [who, setWho] = useState("any");
  const [note, setNote] = useState("");

  // what is being edited (one row at a time)
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof draftOf> | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);

  const sorted = useMemo(() => [...rows].sort((a, b) => key(a).localeCompare(key(b))), [rows]);

  async function reload() {
    const res = await fetch("/api/moments", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      setRows(j.moments || []);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const clean = title.trim();
    if (!clean) return;

    const body: any = { title: clean, kind, who };
    if (note.trim()) body.note = note.trim();
    if (yearly) {
      body.month = Number(month);
      body.day = Number(day);
      if (!body.day) {
        setErr("Faltó el día.");
        return;
      }
      if (birthYear.trim()) body.year = Number(birthYear);
    } else {
      if (!onDate) {
        setErr("Faltó la fecha.");
        return;
      }
      body.on_date = onDate;
    }

    setBusy(true);
    const res = await fetch("/api/moments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || `No se pudo guardar (HTTP ${res.status}).`);
      return;
    }
    setErr(null);
    setTitle("");
    setDay("");
    setOnDate("");
    setBirthYear("");
    setNote("");
    await reload();
  }

  function startEdit(m: Moment) {
    setEditId(m.id);
    setDraft(draftOf(m));
    setEditErr(null);
  }

  function cancelEdit() {
    setEditId(null);
    setDraft(null);
    setEditErr(null);
  }

  async function saveEdit() {
    if (!draft || editId === null) return;
    const body: any = {
      title: draft.title.trim(),
      kind: draft.kind,
      who: draft.who,
      note: draft.note.trim() || null,
    };

    // A row can move between "repeats yearly" and "one-off". Send whichever pair
    // it now belongs to and blank the other, so the CHECK never sees both.
    if (draft.yearly) {
      body.month = Number(draft.month);
      body.day = Number(draft.day);
      body.on_date = null;
      body.year = draft.year.trim() ? Number(draft.year) : null;
      if (!body.day) {
        setEditErr("Faltó el día.");
        return;
      }
    } else {
      if (!draft.on_date) {
        setEditErr("Faltó la fecha.");
        return;
      }
      body.on_date = draft.on_date;
      body.month = null;
      body.day = null;
      body.year = null;
    }
    if (!body.title) {
      setEditErr("Faltó el nombre.");
      return;
    }

    const res = await fetch(`/api/moments/${editId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setEditErr(j.error || `No se pudo guardar (HTTP ${res.status}).`);
      return;
    }
    cancelEdit();
    await reload();
  }

  async function remove(m: Moment) {
    if (!confirm(`¿Borrar "${m.title}"?`)) return;
    setRows((prev) => prev.filter((x) => x.id !== m.id));
    await fetch(`/api/moments/${m.id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div>
      <form className="addcard" onSubmit={add} style={{ marginBottom: 22 }}>
        <div className="chips" role="group" aria-label="Qué fecha es">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className="chip"
              aria-pressed={kind === k.id}
              onClick={() => {
                setKind(k.id);
                setYearly(k.id !== "other");
              }}
            >
              {k.emoji} {k.label}
            </button>
          ))}
        </div>

        <div className="subrow" style={{ alignItems: "stretch" }}>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="¿De quién o de qué nos tenemos que acordar?"
            maxLength={120}
            aria-label="Nombre"
            style={{ flex: "2 1 200px", minWidth: 160 }}
          />
          <label className="field ytog" title="Se repite todos los años o es una sola vez">
            <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
            {yearly ? "↻ Cada año" : "1 vez"}
          </label>
          {yearly ? (
            <>
              <select
                className="field"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Mes"
                style={{ flex: "1 1 110px", minWidth: 96 }}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                className="field"
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                placeholder="Día"
                aria-label="Día"
                style={{ flex: "0 0 70px" }}
              />
              <input
                className="field"
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder={kind === "anniversary" ? "Año (1º)" : "Año (opc.)"}
                aria-label="Año de nacimiento o del primer aniversario"
                title="Opcional: sirve para saber cuántos años cumple"
                style={{ flex: "0 0 110px" }}
              />
            </>
          ) : (
            <input
              className="field"
              type="date"
              value={onDate}
              onChange={(e) => setOnDate(e.target.value)}
              aria-label="Fecha"
              style={{ flex: "1 1 170px" }}
            />
          )}
          <select
            className="field"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            aria-label="De quién"
            style={{ flex: "0 1 128px", minWidth: 108 }}
          >
            {WHO.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
          <button className="btn" type="submit" disabled={busy || !title.trim()} style={{ flex: "0 0 auto" }}>
            {busy ? "Guardando…" : "Agregar"}
          </button>
        </div>

        <input
          className="field"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Detalles (opcional): por qué importa, dónde, con quién"
          maxLength={240}
          aria-label="Detalles"
          style={{ marginTop: 10, width: "100%" }}
        />

        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
      </form>

      {sorted.length === 0 && (
        <div className="empty">Todavía no hay fechas. Agregá la primera arriba.</div>
      )}

      {sorted.map((m) => {
        const k = KINDS.find((x) => x.id === m.kind) || KINDS[2];

        if (editId === m.id && draft) {
          return (
            <div className="item" key={m.id} style={{ alignItems: "flex-start" }}>
              <span className="note-mark" aria-hidden="true">{k.emoji}</span>
              <div className="body" style={{ flex: 1 }}>
                <div className="subrow" style={{ alignItems: "stretch", gap: 8 }}>
                  <input
                    className="field"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    aria-label="Nombre"
                    maxLength={120}
                    style={{ flex: "2 1 180px", minWidth: 150 }}
                  />
                  <select
                    className="field"
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value as Moment["kind"] })}
                    aria-label="Tipo"
                    style={{ flex: "0 0 168px" }}
                  >
                    {KINDS.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.emoji} {x.label}
                      </option>
                    ))}
                  </select>
                  <label className="field ytog">
                    <input
                      type="checkbox"
                      checked={draft.yearly}
                      onChange={(e) => setDraft({ ...draft, yearly: e.target.checked })}
                    />
                    {draft.yearly ? "↻ Cada año" : "1 vez"}
                  </label>
                  {draft.yearly ? (
                    <>
                      <select
                        className="field"
                        value={draft.month}
                        onChange={(e) => setDraft({ ...draft, month: e.target.value })}
                        aria-label="Mes"
                        style={{ flex: "0 1 120px" }}
                      >
                        {MONTHS.map((mo, i) => (
                          <option key={mo} value={i + 1}>
                            {mo}
                          </option>
                        ))}
                      </select>
                      <input
                        className="field"
                        type="number"
                        min={1}
                        max={31}
                        value={draft.day}
                        onChange={(e) => setDraft({ ...draft, day: e.target.value })}
                        placeholder="Día"
                        aria-label="Día"
                        style={{ flex: "0 0 70px" }}
                      />
                      <input
                        className="field"
                        type="number"
                        min={1900}
                        max={new Date().getFullYear()}
                        value={draft.year}
                        onChange={(e) => setDraft({ ...draft, year: e.target.value })}
                        placeholder="Año (opc.)"
                        aria-label="Año"
                        title="Opcional: sirve para saber cuántos años cumple"
                        style={{ flex: "0 0 110px" }}
                      />
                    </>
                  ) : (
                    <input
                      className="field"
                      type="date"
                      value={draft.on_date}
                      onChange={(e) => setDraft({ ...draft, on_date: e.target.value })}
                      aria-label="Fecha"
                      style={{ flex: "1 1 160px" }}
                    />
                  )}
                  <select
                    className="field"
                    value={draft.who}
                    onChange={(e) => setDraft({ ...draft, who: e.target.value })}
                    aria-label="De quién"
                    style={{ flex: "0 1 128px" }}
                  >
                    {WHO.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  className="field"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="Detalles (opcional)"
                  maxLength={240}
                  aria-label="Detalles"
                  style={{ marginTop: 8, width: "100%" }}
                />

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn" onClick={saveEdit}>
                    Guardar
                  </button>
                  <button className="btn-quiet" onClick={cancelEdit}>
                    Cancelar
                  </button>
                </div>
                {editErr && <div className="err" style={{ marginTop: 8 }}>{editErr}</div>}
              </div>
            </div>
          );
        }

        return (
          <div className="item" key={m.id}>
            <span className="note-mark" aria-hidden="true">{k.emoji}</span>
            <div className="body">
              <div className="title">{m.title}</div>
              <div className="meta">
                <span>{label(m)}</span>
                <span>·</span>
                <span>{m.on_date ? "una sola vez" : milestone(m) || "todos los años"}</span>
                <span>·</span>
                <span>{WHO.find((w) => w.id === m.who)?.label || "De los dos"}</span>
              </div>
              {m.note && (
                <div className="meta" style={{ marginTop: 4 }}>
                  {m.note}
                </div>
              )}
            </div>
            <button className="edit" onClick={() => startEdit(m)} aria-label="Editar" title="Editar">
              ✎
            </button>
            <button className="del" onClick={() => remove(m)} aria-label="Delete">
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
