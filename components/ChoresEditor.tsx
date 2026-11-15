"use client";

import { useState } from "react";
import { ANY, PEOPLE } from "../lib/people";

export type Chore = {
  id: number;
  title: string;
  who: string;
  routine: "morning" | "after" | "evening" | "any";
  freq: "daily" | "weekly" | "biweekly" | "monthly";
  emoji: string | null;
  done_on: string | null;
  done: boolean;
  created_by: string;
  created_at: string;
};

const ROUTINES: { id: Chore["routine"]; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "after", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "any", label: "Any time" },
];

const FREQS: { id: Chore["freq"]; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
];

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

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#7A756B",
};

const ALL = [...PEOPLE, ANY];
const nameOf = (id: string) => ALL.find((p) => p.id === id)?.name ?? id;
const colourOf = (id: string) => ALL.find((p) => p.id === id)?.colour ?? "#7A756B";
const routineLabel = (id: string) => ROUTINES.find((r) => r.id === id)?.label ?? "Any time";
const freqLabel = (id: string) => FREQS.find((f) => f.id === id)?.label ?? "Daily";

export default function ChoresEditor({ initial }: { initial: Chore[] }) {
  const [chores, setChores] = useState<Chore[]>(initial);
  const [title, setTitle] = useState("");
  const [who, setWho] = useState(PEOPLE[0]?.id ?? "any");
  const [routine, setRoutine] = useState<Chore["routine"]>("any");
  const [freq, setFreq] = useState<Chore["freq"]>("daily");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ title: "", who: "", routine: "any" as Chore["routine"], freq: "daily" as Chore["freq"] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), who, routine, freq }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "could not save");
      setChores((prev) => [...prev, j.chore as Chore]);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Chore) {
    setChores((prev) => prev.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)));
    const res = await fetch(`/api/chores/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !c.done }),
    });
    if (!res.ok) {
      setChores((prev) => prev.map((x) => (x.id === c.id ? { ...x, done: c.done } : x)));
      setError("Could not update.");
    }
  }

  async function save(id: number) {
    if (!draft.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft.title.trim(), who: draft.who, routine: draft.routine, freq: draft.freq }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "could not save");
      setChores((prev) => prev.map((x) => (x.id === id ? (j.chore as Chore) : x)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Chore) {
    if (!confirm(`Delete "${c.title}"?`)) return;
    const before = chores;
    setChores((prev) => prev.filter((x) => x.id !== c.id));
    const res = await fetch(`/api/chores/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      setChores(before);
      setError("Could not delete.");
    }
  }

  const lanes = [...PEOPLE, ANY].map((p) => ({
    person: p,
    items: chores.filter((c) => c.who === p.id),
  }));

  return (
    <div>
      <form onSubmit={add} className="chore-form">
        <label style={{ display: "grid", gap: 6 }}>
          <span style={label}>Chore</span>
          <input
            style={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Empty the dishwasher"
            maxLength={200}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={label}>Who</span>
          <select style={field} value={who} onChange={(e) => setWho(e.target.value)}>
            {ALL.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={label}>When</span>
          <select
            style={field}
            value={routine}
            onChange={(e) => setRoutine(e.target.value as Chore["routine"])}
          >
            {ROUTINES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={label}>Frequency</span>
          <select style={field} value={freq} onChange={(e) => setFreq(e.target.value as Chore["freq"])}>
            {FREQS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn" disabled={busy || !title.trim()}>
          {busy ? "…" : "Add"}
        </button>
      </form>

      {error && <div style={{ color: "#B42318", marginBottom: 10, fontSize: 14 }}>{error}</div>}

      <div className="chore-lanes">
        {lanes.map(({ person, items }) => {
          const done = items.filter((c) => c.done).length;
          return (
            <section key={person.id} className="chore-lane" style={{ borderTopColor: colourOf(person.id) }}>
              <header className="chore-lane-head">
                <span className="dot" style={{ background: colourOf(person.id) }} />
                <b>{person.name}</b>
                <span className="chore-count">
                  {items.length ? `${done}/${items.length}` : "—"}
                </span>
              </header>

              {items.length === 0 ? (
                <div className="chore-empty">Nothing assigned</div>
              ) : (
                items.map((c) =>
                  editing === c.id ? (
                    <div key={c.id} className="chore-row chore-row--edit">
                      <input
                        style={field}
                        value={draft.title}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      />
                      <select
                        style={field}
                        value={draft.who}
                        onChange={(e) => setDraft((d) => ({ ...d, who: e.target.value }))}
                      >
                        {ALL.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        style={field}
                        value={draft.routine}
                        onChange={(e) => setDraft((d) => ({ ...d, routine: e.target.value as Chore["routine"] }))}
                      >
                        {ROUTINES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <select
                        style={field}
                        value={draft.freq}
                        onChange={(e) => setDraft((d) => ({ ...d, freq: e.target.value as Chore["freq"] }))}
                      >
                        {FREQS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <div className="chore-actions">
                        <button className="btn" onClick={() => save(c.id)} disabled={busy}>
                          Save
                        </button>
                        <button className="btn btn--ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={c.id} className={"chore-row" + (c.done ? " is-done" : "")}>
                      <button
                        className="chore-check"
                        onClick={() => toggle(c)}
                        aria-label={c.done ? "Mark as not done" : "Mark as done"}
                      >
                        {c.done ? "✓" : ""}
                      </button>
                      <span className="chore-title">
                        {c.title}
                        <small className="chore-meta">
                          {routineLabel(c.routine)} · {freqLabel(c.freq)}
                        </small>
                      </span>
                      <span className="chore-actions">
                        <button
                          className="btn btn--ghost"
                          onClick={() => {
                            setEditing(c.id);
                            setDraft({ title: c.title, who: c.who, routine: c.routine, freq: c.freq });
                          }}
                        >
                          Edit
                        </button>
                        <button className="btn btn--ghost" onClick={() => remove(c)} aria-label={`Delete ${c.title}`}>
                          ✕
                        </button>
                      </span>
                    </div>
                  )
                )
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
