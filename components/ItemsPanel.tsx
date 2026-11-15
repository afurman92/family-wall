"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Kind = "task" | "shop" | "note";

type Item = {
  id: number | string;
  kind: Kind | "event";
  title: string;
  detail: string | null;
  who: string | null;
  due_at: string | null;
  done: boolean;
  created_by: string;
  created_at?: string;
};

// Events are deliberately absent: they belong in the familia Google Calendar,
// which the frame already reads. This list is for things that have no home there.
const KINDS: { id: Kind; label: string; emoji: string }[] = [
  { id: "task", label: "To do", emoji: "✓" },
  { id: "shop", label: "Shopping", emoji: "🛒" },
  { id: "note", label: "Note", emoji: "✎" },
];

// Exact person colours from the kitchen frame (data.js): Alex blue,
// Jordan magenta, Maya green. Muse is an agent, so it stays grey.
const PEOPLE: Record<string, { colour: string; name: string }> = {
  alex: { colour: "#2D5BFF", name: "Alex" },
  jordan: { colour: "#E4007C", name: "Jordan" },
  maya: { colour: "#00A36C", name: "Maya" },
  muse: { colour: "#7A756B", name: "Muse" },
  notion: { colour: "#7A756B", name: "Notion" },
};

function person(id: string | null | undefined) {
  if (!id) return { colour: "#7A756B", name: "" };
  return PEOPLE[id] || { colour: "#7A756B", name: id };
}

const TZ = "America/Toronto";

const PLACEHOLDER: Record<Kind, string> = {
  task: "What needs doing?",
  shop: "What do we need?",
  note: "Leave a note for the family",
};

function dayLabel(iso: string): { text: string; overdue: boolean } {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((that.getTime() - today.getTime()) / 86400000);

  const time = d.toLocaleTimeString("en-CA", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });

  if (diff === 0) return { text: `Today ${time}`, overdue: d < now };
  if (diff === 1) return { text: `Tomorrow ${time}`, overdue: false };
  if (diff === -1) return { text: `Yesterday ${time}`, overdue: true };
  if (diff < 0) return { text: `${Math.abs(diff)} days ago`, overdue: true };
  if (diff < 7)
    return {
      text: d.toLocaleDateString("en-CA", { timeZone: TZ, weekday: "short" }) + " " + time,
      overdue: false,
    };
  return {
    text: d.toLocaleDateString("en-CA", { timeZone: TZ, month: "short", day: "numeric" }),
    overdue: false,
  };
}

type Props = {
  // Which lists this instance owns. The home page mounts two: tasks in the main
  // column, shopping + notes in the sidebar.
  kinds?: Kind[];
  composer?: boolean;
};

// Tasks read best grouped by urgency; a flat list of 25 says nothing about
// what to do next. Undated items fall to the end.
function bucketOf(iso: string | null): { key: number; label: string } {
  if (!iso) return { key: 9, label: "No date" };
  const d = new Date(iso);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const td = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((td - t0) / 86400000);
  if (diff < 0) return { key: 0, label: "Overdue" };
  if (diff === 0) return { key: 1, label: "Today" };
  if (diff === 1) return { key: 2, label: "Tomorrow" };
  if (diff <= 7) return { key: 3, label: "This week" };
  return { key: 4, label: "Later" };
}

// One composer per list, sitting under that list's own heading. The heading
// says what the box creates, so there is nothing to pick before typing.
function AddForm({
  kind,
  onAdded,
  onError,
}: {
  kind: Kind;
  onAdded: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [detail, setDetail] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || busy) return;
    setBusy(true);
    const pendingDue = due;
    const pendingDetail = detail.trim();
    setTitle("");
    setDetail("");
    setDue("");

    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          title: clean,
          detail: pendingDetail || undefined,
          due_at: pendingDue ? new Date(pendingDue).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        onError(j.error || `Couldn't save (HTTP ${res.status}).`);
        setTitle(clean);
        return;
      }
      onError(null);
      await onAdded();
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="addcard" onSubmit={submit}>
      <input
        ref={inputRef}
        className="field"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={PLACEHOLDER[kind]}
        maxLength={200}
        aria-label={PLACEHOLDER[kind]}
        enterKeyHint="done"
      />

      <div className="subrow">
        {more ? (
          <>
            {kind !== "note" && (
              <input
                className="field"
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                aria-label="When"
              />
            )}
            <input
              className="field"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Details (optional)"
              maxLength={500}
              aria-label="Details"
            />
          </>
        ) : (
          <button type="button" className="btn-quiet" onClick={() => setMore(true)}>
            + {kind === "note" ? "Details" : "When or details"}
          </button>
        )}
        <button className="btn" type="submit" disabled={busy || !title.trim()}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}

export default function ItemsPanel({ kinds, composer = true }: Props = {}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/items?includeDone=${showDone ? 1 : 0}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.hint || j.error || `HTTP ${res.status}`);
        setLoaded(true);
        return;
      }
      const j = await res.json();
      setItems(j.items || []);
      setErr(null);
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setLoaded(true);
    }
  }, [showDone]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(it: Item) {
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
    await fetch(`/api/items/${it.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ done: !it.done }),
    });
    await load();
  }

  async function remove(it: Item) {
    setItems((prev) => prev.filter((x) => x.id !== it.id));
    await fetch(`/api/items/${it.id}`, { method: "DELETE" });
    await load();
  }

  const grouped = useMemo(() => {
    const g: Record<string, Item[]> = { task: [], shop: [], note: [] };
    for (const it of items) (g[it.kind] || (g.task as Item[])).push(it);
    return g;
  }, [items]);

  const shown = KINDS.filter((k) => !kinds || kinds.indexOf(k.id) > -1);
  const openCount = items.filter((i) => !i.done && (!kinds || kinds.indexOf(i.kind as Kind) > -1)).length;

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 16 }}>{err}</div>}

      {shown.map((k) => {
        const rows = grouped[k.id];
        // With a composer the section always exists, even empty: the input is
        // how the first item gets in.
        if (!rows.length && !composer) return null;
        const open = rows.filter((r) => !r.done).length;
        const ordered =
          k.id === "task"
            ? [...rows].sort(
                (a, b) =>
                  bucketOf(a.due_at).key - bucketOf(b.due_at).key ||
                  (a.due_at || "").localeCompare(b.due_at || "")
              )
            : rows;
        const labels = ordered.map((it) => (k.id === "task" ? bucketOf(it.due_at).label : ""));
        const multi = new Set(labels).size > 1;
        return (
          <section className="section" key={k.id}>
            <div className="sechead">
              <h2>
                {k.emoji} {k.label}
              </h2>
              <span className="count">{open}</span>
            </div>

            {composer && <AddForm kind={k.id} onAdded={load} onError={setErr} />}

            {!composer && rows.length === 0 && <div className="empty">Nothing here yet.</div>}

            {ordered.map((it, idx) => {
              const p = person(it.created_by);
              const glabel = labels[idx];
              const showLabel = multi && (idx === 0 || glabel !== labels[idx - 1]);
              const when = it.due_at ? dayLabel(it.due_at) : null;
              return (
                <Fragment key={it.id}>
                {showLabel && <div className="group-label">{glabel}</div>}
                <div className={"item" + (it.done ? " done" : "")}>
                  {it.kind === "note" ? (
                    <span className="note-mark" aria-hidden="true">
                      ✎
                    </span>
                  ) : (
                    <button
                      className="check"
                      role="checkbox"
                      aria-checked={it.done}
                      aria-label={it.title}
                      onClick={() => toggle(it)}
                    >
                      ✓
                    </button>
                  )}
                  <div className="body">
                    <div className="title">{it.title}</div>
                    <div className="meta">
                      {when && <span className={when.overdue ? "overdue" : ""}>{when.text}</span>}
                      {when && (it.detail || p.name) && <span>·</span>}
                      {it.detail && <span>{it.detail}</span>}
                      {it.detail && p.name && <span>·</span>}
                      {p.name && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <span className="dot" style={{ background: p.colour }} />
                          {p.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="del" onClick={() => remove(it)} aria-label="Delete">
                    ✕
                  </button>
                </div>
                </Fragment>
              );
            })}
          </section>
        );
      })}

      {loaded && openCount === 0 && !err && !composer && (
        <div className="empty">
          Nothing on the list. Add the first thing above — the kitchen frame picks it up within
          a minute.
        </div>
      )}

      {openCount > 0 || showDone ? (
        <button className="btn-quiet" onClick={() => setShowDone((v) => !v)}>
          {showDone ? "Hide completed" : "Show completed"}
        </button>
      ) : null}
    </>
  );
}
