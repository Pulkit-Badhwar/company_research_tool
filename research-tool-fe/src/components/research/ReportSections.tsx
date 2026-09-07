import type { ReactNode } from "react";
import {
  SECTION_ORDER,
  SECTION_TITLES,
  type Financials,
  type Person,
  type SectionData,
  type SectionKey,
} from "@/lib/api";
import "./ReportSections.scss";

export type SectionStatus = "idle" | "loading" | "done";

interface Props {
  data: SectionData;
  status: Record<SectionKey, SectionStatus>;
}

const NOT_AVAILABLE = "Not available";

export function ReportSections({ data, status }: Props) {
  return (
    <div className="section-stack">
      {SECTION_ORDER.map((key) => (
        <SectionCard key={key} title={SECTION_TITLES[key]} status={status[key]}>
          {status[key] === "done" ? renderSection(key, data) : <Skeleton section={key} />}
        </SectionCard>
      ))}
    </div>
  );
}

function SectionCard({ title, status, children }: { title: string; status: SectionStatus; children: ReactNode }) {
  const done = status === "done";
  return (
    <section className={`section-card${done ? " done" : ""}`} aria-busy={status !== "done"}>
      <div className="section-header">
        <span className={`section-dot${done ? " done" : status === "loading" ? " loading" : ""}`} />
        <h3 className={`section-title${done ? " done" : ""}`}>{title}</h3>
        {status === "loading" && <span className="loading-label">Generating…</span>}
      </div>
      {children}
    </section>
  );
}

function renderSection(key: SectionKey, data: SectionData) {
  switch (key) {
    case "overview":
      return <Overview text={data.overview} />;
    case "key_people":
      return <KeyPeople people={data.key_people} />;
    case "news":
      return <Bullets items={data.news} emptyLabel="No recent news found." />;
    case "financials":
      return <FinancialGrid financials={data.financials} />;
    case "risks":
      return <Bullets items={data.risks} emptyLabel="No notable risks identified." variant="risk" />;
  }
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="empty-text">{children}</p>;
}

function Overview({ text }: { text: string | null | undefined }) {
  if (typeof text !== "string" || !text.trim()) return <Empty>{NOT_AVAILABLE}</Empty>;
  return <p className="overview-text">{text}</p>;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function KeyPeople({ people }: { people: Person[] | null | undefined }) {
  const list = Array.isArray(people) ? people.filter((p) => p && (p.name || p.title)) : [];
  if (list.length === 0) return <Empty>No key people listed.</Empty>;
  return (
    <ul className="people-list">
      {list.map((p, i) => (
        <li className="person-item" key={`${p.name}-${i}`}>
          <div className="person-initials">{initials(p.name || "?") || "?"}</div>
          <div className="person-meta">
            <p className="person-name">{p.name || NOT_AVAILABLE}</p>
            <p className="person-title">{p.title || NOT_AVAILABLE}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Bullets({ items, emptyLabel, variant = "news" }: { items: string[] | null | undefined; emptyLabel: string; variant?: "news" | "risk" }) {
  const list = Array.isArray(items) ? items.filter((s) => typeof s === "string" && s.trim()) : [];
  if (list.length === 0) return <Empty>{emptyLabel}</Empty>;
  return (
    <ul className="bullet-list">
      {list.map((item, i) => (
        <li className={`bullet-item${variant === "risk" ? " risk" : ""}`} key={i}>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const FIN_FIELDS: { key: keyof Financials; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "employee_count", label: "Employees" },
  { key: "market_cap", label: "Market Cap" },
  { key: "yoy_growth", label: "YoY Growth" },
];

function FinancialGrid({ financials }: { financials: Financials | null | undefined }) {
  return (
    <div className="financial-grid">
      {FIN_FIELDS.map(({ key, label }) => {
        const raw = financials?.[key];
        const value = typeof raw === "string" && raw.trim() ? raw : null;
        const isGrowth = key === "yoy_growth" && value !== null;
        const lower = value ? value.trim().toLowerCase() : "";
        return (
          <div className="stat-card" key={key}>
            <p className="stat-label">{label}</p>
            <p className={`stat-value${isGrowth && lower.startsWith("-") ? " danger" : isGrowth ? " success" : value === null ? " muted" : ""}`}>
              {value ?? NOT_AVAILABLE}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Skeleton({ section }: { section: SectionKey }) {
  if (section === "financials") {
    return (
      <div className="skeleton-grid">
        {FIN_FIELDS.map(({ key }) => (
          <div className="skeleton-tile" key={key}>
            <div className="skeleton-line wide" />
            <div className="skeleton-spacer">
              <div className="skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (section === "key_people") {
    return (
      <ul className="people-list">
        {[0, 1].map((i) => (
          <li className="person-item" key={i}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
            <div className="person-meta">
              <div className="skeleton-line" />
              <div className="skeleton-spacer">
                <div className="skeleton-line wide" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  const widths = section === "risks" ? ["w-10/12", "w-3/5"] : ["w-11/12", "w-4/5", "w-2/3"];
  return (
    <ul className="bullet-list">
      {widths.map((w) => (
        <li key={w}><div className="skeleton-line" style={{ width: w.includes("10/12") ? "83%" : w.includes("3/5") ? "62%" : w.includes("4/5") ? "80%" : "66%" }} /></li>
      ))}
    </ul>
  );
}
