import { ensureSchema, listDocuments } from "../../lib/db";
import DocumentsEditor from "../../components/DocumentsEditor";
import Shell from "../../components/Shell";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  await ensureSchema();
  const docs = await listDocuments();

  return (
    <div className="shell">
      <Shell active="documents" />

      <div style={{ maxWidth: 1080 }}>
        <div className="sechead">
          <h2>Documents</h2>
          <span className="count">{docs.length}</span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--mute)" }}>
          Pasaportes, DNI, residencias, licencias. Los escaneos viven en almacenamiento privado:
          solo se abren desde acá, con tu sesión.
        </p>
        <DocumentsEditor initial={docs} />
      </div>
    </div>
  );
}
