import Link from "next/link";

const LINKS = [
  { href: "/", label: "Today", id: "today" },
  { href: "/calendar", label: "Calendar", id: "calendar" },
  { href: "/air-fryer", label: "Air Fryer", id: "air-fryer" },
  { href: "/documents", label: "Documents", id: "documents" },
];

export default function Shell({
  active,
  dateLine,
}: {
  active: "today" | "calendar" | "air-fryer" | "documents";
  dateLine?: string;
}) {
  return (
    <header className="shell-head">
      <Link href="/" className="brand" style={{ textDecoration: "none" }}>
        Home
      </Link>
      {dateLine ? <div className="shell-date">{dateLine}</div> : null}
      <nav className="nav">
        {LINKS.map((l) => (
          <Link key={l.id} href={l.href} aria-current={active === l.id ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
