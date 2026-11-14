"use client";

import { useMemo, useState } from "react";

type Doc = {
  id: number | string;
  country: string | null;
  doc_type: string | null;
  number: string | null;
  expires_on: string | null;
  file_url: string | null;
};

const TZ = process.env.NEXT_PUBLIC_HOME_TZ || "America/Toronto";

function expiry(iso: string | null): { days: number; text: string } | null {
  if (!iso) return null;
  const d = new Date(/T/.test(iso) ? iso : iso + "T12:00:00Z");
  if (isNaN(d.getTime())) return null;
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return { days, text: `expired ${Math.abs(days)}d ago` };
  return { days, text: `${days}d left` };
}

export default function DocumentsPanel({ docs }: { docs: Doc[] }) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs
      .filter((d) => {
        if (!needle) return true;
        return [d.country, d.doc_type, d.number].filter(Boolean).join(" ").toLowerCase().includes(needle);
      })
      // A document about to expire is the thing you actually need to find.
      .sort((a, b) => {
        const ea = expiry(a.expires_on)?.days;
        const eb = expiry(b.expires_on)?.days;
        if (ea == null && eb == null) return 0;
        if (ea == null) return 1;
        if (eb == null) return -1;
        return ea - eb;
      });
  }, [docs, q]);

  return (
    <section className="block">
      <div className="sechead">
        <h2>Documents</h2>
        <span className="count">{rows.length}</span>
      </div>

      {docs.length > 5 && (
        <input
          className="field field--sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, country or number"
          aria-label="Search documents"
        />
      )}

      {rows.length === 0 && <p className="empty">No document matches “{q}”.</p>}

      {rows.map((d) => {
        const ex = expiry(d.expires_on);
        const label = [d.country, d.doc_type].filter(Boolean).join(" · ") || "Document";
        return (
          <div className="doc" key={d.id}>
            <span className="dicon">▤</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="dtitle">{label}</div>
              <div className="dmeta">
                {d.number ? <span>{d.number}</span> : null}
                {ex ? (
                  <span style={{ marginLeft: d.number ? 6 : 0 }}>
                    {ex.days < 0 ? (
                      <span className="tag tag--late">{ex.text}</span>
                    ) : ex.days < 183 ? (
                      <span className="tag tag--soon">{ex.text}</span>
                    ) : (
                      <span className="muted">{ex.text}</span>
                    )}
                  </span>
                ) : null}
              </div>
              {d.file_url && (
                <a className="dlink" href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer">
                  Ver escaneo ↗
                </a>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
