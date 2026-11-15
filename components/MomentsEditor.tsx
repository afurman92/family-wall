"use client";

import { useMemo, useState } from "react";

type Moment = {
  id: number;
  title: string;
  kind: "birthday" | "anniversary" | "other";
  month: number | null;
  day: number | null;
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

function label(m: Moment) {
  if (m.on_date) {
    const [y, mo, d] = m.on_date.split("-").map(Number);
    return `${d} de ${MONTHS[mo - 1]} de ${y}`;
  }
  return `${m.day} de ${MONTHS[(m.month || 1) - 1]}`;
}

// Months and days mixed into one sortable key: what the house reads calendar-wise.
function key(m: Moment) {
  if (m.on_date) return m.on_date;
  return `1900-${String(m.month).padStart(2, "0")}-${String(m.day).padStart(2, "0")}`;
}

export default function MomentsEditor({ initial }: { initial: Moment[] }) {
  const [rows, setRows] = useState<Moment[]>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Moment["kind"]>("birthday");
  const [yearly, setYearly] = useState(true);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [day, setDay] = useState("");
  const [onDate, setOnDate] = useState("");
  const [who, setWho] = useState("any");

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
    if (yearly) {
      body.month = Number(month);
      body.day = Number(day);
      if (!body.day) {
        setErr("Faltó el día.");
        return;
      }
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
            style={{ flex: "2 1 260px" }}
          />
          <label className="field ytog" title="Se repite todos los años o es una sola vez">
          <input
            type="checkbox"
            checked={yearly}
            onChange={(e) => setYearly(e.target.checked)}
          />
          {yearly ? "↻ Cada año" : "1 vez"}
          </label>
          {yearly ? (
            <>
              <select
                className="field"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Mes"
                style={{ flex: "1 1 130px" }}
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
                style={{ flex: "0 1 90px" }}
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
            style={{ flex: "0 1 150px" }}
          >
            {WHO.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
          <button className="btn" type="submit" disabled={busy || !title.trim()}>
            {busy ? "Guardando…" : "Agregar"}
          </button>
        </div>
        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
      </form>

      {sorted.length === 0 && (
        <div className="empty">Todavía no hay fechas. Agregá la primera arriba.</div>
      )}

      {sorted.map((m) => {
        const k = KINDS.find((x) => x.id === m.kind) || KINDS[2];
        return (
          <div className="item" key={m.id}>
            <span className="note-mark" aria-hidden="true">{k.emoji}</span>
            <div className="body">
              <div className="title">{m.title}</div>
              <div className="meta">
                <span>{label(m)}</span>
                <span>·</span>
                <span>{m.on_date ? "una sola vez" : "todos los años"}</span>
                <span>·</span>
                <span>{WHO.find((w) => w.id === m.who)?.label || "De los dos"}</span>
              </div>
            </div>
            <button className="del" onClick={() => remove(m)} aria-label="Delete">
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
