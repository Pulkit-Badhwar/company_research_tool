import type { ReactNode } from "react";
import { styled, css } from "styled-components";
import {
  SECTION_ORDER,
  SECTION_TITLES,
  type Financials,
  type Person,
  type SectionData,
  type SectionKey,
} from "@/lib/api";

export type SectionStatus = "idle" | "loading" | "done";

interface Props {
  data: SectionData;
  status: Record<SectionKey, SectionStatus>;
}

const NOT_AVAILABLE = "Not available";

const SectionStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.4rem;
`;

const SectionCardWrap = styled.section<{ $done: boolean }>`
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 1.5rem;
  padding: 1.25rem;
  box-shadow: 0 18px 38px rgba(28, 26, 54, 0.06);
  backdrop-filter: blur(20px);
  animation: ${({ $done }) => ($done ? "section-in 0.45s cubic-bezier(0.32, 0.72, 0, 1) both" : "none")};
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
`;

const Dot = styled.span<{ $done: boolean; $loading: boolean }>`
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: ${({ $done, $loading }) => {
    if ($done) return "#5a46d9";
    if ($loading) return "rgba(90, 70, 217, 0.2)";
    return "rgba(95, 103, 135, 0.28)";
  }};
  ${({ $loading }) =>
    $loading &&
    css`
      animation: shimmer 1.4s linear infinite;
    `}
`;

const SectionTitle = styled.h3<{ $done: boolean }>`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${({ $done }) => ($done ? "#1a1d2d" : "#5f6787")};
`;

const LoadingLabel = styled.span`
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 600;
  color: #5f6787;
`;

const EmptyText = styled.p`
  margin: 0;
  color: rgba(95, 103, 135, 0.84);
  font-size: 0.88rem;
  line-height: 1.6;
`;

const OverviewText = styled.p`
  margin: 0;
  color: #5f6787;
  line-height: 1.75;
  font-size: 0.94rem;
`;

const PeopleList = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.8rem;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const PersonItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 0.9rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.7);
`;

const PersonInitials = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.8rem;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(90, 70, 217, 0.12), rgba(90, 70, 217, 0.04));
  color: #4337b8;
  font-size: 0.8rem;
  font-weight: 700;
`;

const PersonMeta = styled.div`
  min-width: 0;
  flex: 1;
`;

const PersonName = styled.p`
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PersonTitle = styled.p`
  margin: 0.2rem 0 0;
  color: #5f6787;
  font-size: 0.72rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BulletList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;

const BulletItem = styled.li<{ $risk?: boolean }>`
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  color: #5f6787;
  font-size: 0.94rem;
  line-height: 1.7;

  &::before {
    content: "";
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    margin-top: 0.6rem;
    display: inline-block;
    background: ${({ $risk }) => ($risk ? "#d86363" : "#5a46d9")};
    flex-shrink: 0;
  }
`;

const FinancialGridWrap = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.8rem;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 1rem;
  padding: 0.95rem;
`;

const StatLabel = styled.p`
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #5f6787;
`;

const StatValue = styled.p<{ $danger?: boolean; $success?: boolean; $muted?: boolean }>`
  margin: 0.5rem 0 0;
  font-size: clamp(1.2rem, 2vw, 1.8rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  color: ${({ $danger, $success, $muted }) => {
    if ($danger) return "#d86363";
    if ($success) return "#29a77a";
    if ($muted) return "#5f6787";
    return "#1a1d2d";
  }};
`;

const SkeletonGrid = styled.div`
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.8rem;
`;

const SkeletonTile = styled.div`
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.42);
  padding: 0.95rem;
  min-height: 5.1rem;
`;

const SkeletonLine = styled.div<{ $wide?: boolean }>`
  display: block;
  width: ${({ $wide }) => ($wide ? "70%" : "40%")};
  height: 0.8rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  animation: shimmer 1.4s linear infinite;
`;

export function ReportSections({ data, status }: Props) {
  return (
    <SectionStack>
      {SECTION_ORDER.map((key) => (
        <SectionCard key={key} title={SECTION_TITLES[key]} status={status[key]}>
          {status[key] === "done" ? renderSection(key, data) : <Skeleton section={key} />}
        </SectionCard>
      ))}
    </SectionStack>
  );
}

function SectionCard({ title, status, children }: { title: string; status: SectionStatus; children: ReactNode }) {
  const done = status === "done";
  return (
    <SectionCardWrap $done={done} aria-busy={status !== "done"}>
      <SectionHeader>
        <Dot $done={done} $loading={status === "loading"} />
        <SectionTitle $done={done}>{title}</SectionTitle>
        {status === "loading" && <LoadingLabel>Generating…</LoadingLabel>}
      </SectionHeader>
      {children}
    </SectionCardWrap>
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
  return <EmptyText>{children}</EmptyText>;
}

function Overview({ text }: { text: string | null | undefined }) {
  if (typeof text !== "string" || !text.trim()) return <Empty>{NOT_AVAILABLE}</Empty>;
  return <OverviewText>{text}</OverviewText>;
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
    <PeopleList>
      {list.map((p, i) => (
        <PersonItem key={`${p.name}-${i}`}>
          <PersonInitials>{initials(p.name || "?") || "?"}</PersonInitials>
          <PersonMeta>
            <PersonName>{p.name || NOT_AVAILABLE}</PersonName>
            <PersonTitle>{p.title || NOT_AVAILABLE}</PersonTitle>
          </PersonMeta>
        </PersonItem>
      ))}
    </PeopleList>
  );
}

function Bullets({ items, emptyLabel, variant = "news" }: { items: string[] | null | undefined; emptyLabel: string; variant?: "news" | "risk" }) {
  const list = Array.isArray(items) ? items.filter((s) => typeof s === "string" && s.trim()) : [];
  if (list.length === 0) return <Empty>{emptyLabel}</Empty>;
  return (
    <BulletList>
      {list.map((item, i) => (
        <BulletItem key={i} $risk={variant === "risk"}>
          <span>{item}</span>
        </BulletItem>
      ))}
    </BulletList>
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
    <FinancialGridWrap>
      {FIN_FIELDS.map(({ key, label }) => {
        const raw = financials?.[key];
        const value = typeof raw === "string" && raw.trim() ? raw : null;
        const isGrowth = key === "yoy_growth" && value !== null;
        const lower = value ? value.trim().toLowerCase() : "";
        return (
          <StatCard key={key}>
            <StatLabel>{label}</StatLabel>
            <StatValue $danger={isGrowth && lower.startsWith("-")} $success={isGrowth && !lower.startsWith("-")} $muted={value === null}>
              {value ?? NOT_AVAILABLE}
            </StatValue>
          </StatCard>
        );
      })}
    </FinancialGridWrap>
  );
}

function Skeleton({ section }: { section: SectionKey }) {
  if (section === "financials") {
    return (
      <SkeletonGrid>
        {FIN_FIELDS.map(({ key }) => (
          <SkeletonTile key={key}>
            <SkeletonLine $wide />
            <div style={{ marginTop: 12 }}>
              <SkeletonLine />
            </div>
          </SkeletonTile>
        ))}
      </SkeletonGrid>
    );
  }
  if (section === "key_people") {
    return (
      <PeopleList>
        {[0, 1].map((i) => (
          <PersonItem key={i}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
            <PersonMeta>
              <SkeletonLine />
              <div style={{ marginTop: 8 }}>
                <SkeletonLine $wide />
              </div>
            </PersonMeta>
          </PersonItem>
        ))}
      </PeopleList>
    );
  }
  const widths = section === "risks" ? ["w-10/12", "w-3/5"] : ["w-11/12", "w-4/5", "w-2/3"];
  return (
    <BulletList>
      {widths.map((w) => (
        <li key={w}> <SkeletonLine style={{ width: w.includes("10/12") ? "83%" : w.includes("3/5") ? "62%" : w.includes("4/5") ? "80%" : "66%" }} /></li>
      ))}
    </BulletList>
  );
}
