import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { History, Search } from "lucide-react";
import { styled, css } from "styled-components";
import {
  FRIENDLY_ERROR,
  SECTION_ORDER,
  checkHealth,
  deleteReport,
  getReport,
  listReports,
  streamResearch,
  type ReportSummary,
  type SectionData,
  type SectionKey,
  type StreamEvent,
} from "@/lib/api";
import { ReportSections, type SectionStatus } from "@/components/research/ReportSections";
import { HistorySidebar, relativeTime } from "@/components/research/HistorySidebar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Research Frontend — Company Research for Sales Teams" },
      {
        name: "description",
        content:
          "Type a company name and get a live, AI-generated research report: overview, key people, news, financials and risks in under two minutes.",
      },
      { property: "og:title", content: "Research Frontend — Company Research for Sales Teams" },
      {
        property: "og:description",
        content: "Live AI research briefings on any company: overview, key people, news, financials and risks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const EMPTY_DATA: SectionData = {
  overview: null,
  key_people: null,
  news: null,
  financials: null,
  risks: null,
};

const IDLE_STATUS: Record<SectionKey, SectionStatus> = {
  overview: "idle",
  key_people: "idle",
  news: "idle",
  financials: "idle",
  risks: "idle",
};

const DONE_STATUS: Record<SectionKey, SectionStatus> = {
  overview: "done",
  key_people: "done",
  news: "done",
  financials: "done",
  risks: "done",
};

type View =
  | { kind: "empty" }
  | { kind: "streaming"; company: string }
  | { kind: "complete"; company: string; createdAt: string; id: number | null }
  | { kind: "loading-saved"; id: number }
  | { kind: "error"; message: string };

const Page = styled.div`
  min-height: 100vh;
  color: #1a1d2d;
`;

const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.52);
  border-bottom: 1px solid rgba(255, 255, 255, 0.7);
`;

const HeaderRow = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const BrandWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
`;

const MobileMenuButton = styled.button`
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.72);
  color: #5f6787;
  cursor: pointer;

  @media (min-width: 768px) {
    display: none;
  }
`;

const BrandMark = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 0.9rem;
  background: linear-gradient(135deg, #5a46d9, #4337b8);
  box-shadow: 0 16px 30px rgba(90, 70, 217, 0.26);
  color: white;
  font-weight: 700;
  font-size: 1.15rem;
`;

const BrandTitle = styled.p`
  margin: 0;
  font-size: 0.94rem;
  font-weight: 700;
  letter-spacing: -0.03em;
`;

const BrandSub = styled.p`
  margin: 0;
  font-size: 0.72rem;
  color: #5f6787;
`;

const StatusPill = styled.div<{ $health: "checking" | "online" | "offline" }>`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.7);
  padding: 0.48rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #5f6787;

  &::before {
    content: "";
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    display: inline-block;
    ${props =>
      props.$health === "online" &&
      css`
        background: #29a77a;
        box-shadow: 0 0 0 4px rgba(41, 167, 122, 0.14);
      `}
    ${props =>
      props.$health === "offline" &&
      css`
        background: #d86363;
        box-shadow: 0 0 0 4px rgba(216, 99, 99, 0.12);
      `}
    ${props =>
      props.$health === "checking" &&
      css`
        background: rgba(90, 70, 217, 0.2);
        animation: shimmer 1.4s linear infinite;
      `}
  }
`;

const Layout = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 2rem;
  display: flex;
  gap: 1.5rem;
`;

const Sidebar = styled.aside`
  width: 18rem;
  flex-shrink: 0;
  display: none;

  @media (min-width: 768px) {
    display: block;
  }
`;

const SidebarInner = styled.div`
  position: sticky;
  top: 5.5rem;
`;

const MobileDrawer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  display: block;

  @media (min-width: 768px) {
    display: none;
  }
`;

const MobileBackdrop = styled.button`
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(20, 24, 41, 0.2);
  backdrop-filter: blur(5px);
`;

const MobilePanel = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  width: min(22rem, 85vw);
  padding: 1rem;
`;

const Main = styled.main`
  min-width: 0;
  flex: 1;
`;

const Box = styled.div`
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 1.5rem;
  box-shadow: 0 18px 38px rgba(28, 26, 54, 0.06);
  backdrop-filter: blur(20px);
`;

const HealthBanner = styled(Box)`
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  border-color: rgba(216, 99, 99, 0.35);
  background: rgba(255, 240, 240, 0.7);

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

const SearchCard = styled(Box)`
  padding: 1rem;
`;

const SearchRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;

  @media (min-width: 640px) {
    flex-direction: row;
  }
`;

const SearchInputWrap = styled.div`
  position: relative;
  flex: 1;
`;

const SearchIcon = styled(Search)`
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1rem;
  height: 1rem;
  color: rgba(95, 103, 135, 0.8);
`;

const SearchInput = styled.input<{ $error?: boolean }>`
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.72);
  padding: 0.88rem 1rem 0.88rem 2.8rem;
  color: #1a1d2d;
  font-size: 0.94rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &::placeholder {
    color: rgba(95, 103, 135, 0.7);
  }

  &:focus {
    border-color: rgba(90, 70, 217, 0.55);
    box-shadow: 0 0 0 4px rgba(90, 70, 217, 0.14);
  }

  ${props =>
    props.$error &&
    css`
      border-color: rgba(216, 99, 99, 0.52);
      &:focus {
        border-color: rgba(216, 99, 99, 0.6);
        box-shadow: 0 0 0 4px rgba(216, 99, 99, 0.12);
      }
    `}
`;

const PrimaryButton = styled.button`
  border: none;
  border-radius: 1rem;
  background: linear-gradient(135deg, #5a46d9, #4337b8);
  color: white;
  cursor: pointer;
  font-weight: 700;
  padding: 0.82rem 1.4rem;
  min-width: 8.2rem;
  box-shadow: 0 16px 30px rgba(90, 70, 217, 0.2);
  transition: transform 0.2s ease, filter 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.03);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.62;
    cursor: not-allowed;
  }
`;

const Message = styled.p`
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #d86363;
`;

const LiveStatus = styled.div`
  margin-top: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #5f6787;
  font-size: 0.72rem;
  font-weight: 600;
`;

const EmptyCard = styled(Box)`
  margin-top: 1.5rem;
  padding: 2.5rem 1.25rem;
  text-align: center;
`;

const EmptyIcon = styled.div`
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(90, 70, 217, 0.12), rgba(90, 70, 217, 0.04));
  color: #4337b8;
  margin: 0 auto;
`;

const EmptyTitle = styled.h1`
  margin: 1rem 0 0;
  font-size: clamp(1.3rem, 2vw, 1.8rem);
  letter-spacing: -0.04em;
`;

const EmptyText = styled.p`
  max-width: 32rem;
  margin: 0.75rem auto 0;
  color: #5f6787;
  line-height: 1.6;
  font-size: 0.9rem;
`;

const ErrorCard = styled(Box)`
  margin-top: 1.5rem;
  padding: 2rem 1.25rem;
  text-align: center;
  border-color: rgba(216, 99, 99, 0.3);
`;

const ErrorTitle = styled.h1`
  margin: 0;
  font-size: 1.18rem;
  letter-spacing: -0.04em;
`;

const ErrorText = styled.p`
  max-width: 32rem;
  margin: 0.75rem auto 0;
  color: #5f6787;
  line-height: 1.7;
  font-size: 0.9rem;
`;

const SecondaryButton = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.6);
  color: #1a1d2d;
  padding: 0.7rem 1rem;
  margin-top: 1.25rem;
  font-weight: 600;
  cursor: pointer;
`;

const ReportHeader = styled.div`
  margin-top: 1.5rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
`;

const ReportMeta = styled.p`
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #4337b8;
`;

const ReportName = styled.h1`
  margin: 0.45rem 0 0;
  font-size: clamp(2rem, 3vw, 2.7rem);
  letter-spacing: -0.05em;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ReportTime = styled.span`
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  font-size: 0.72rem;
  color: #5f6787;
  padding: 0.45rem 0.7rem;
`;

function Index() {
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "empty" });
  const [data, setData] = useState<SectionData>(EMPTY_DATA);
  const [status, setStatus] = useState<Record<SectionKey, SectionStatus>>(IDLE_STATUS);
  const [actionError, setActionError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const refreshReports = useCallback(async () => {
    try {
      const list = await listReports();
      setReports(list);
    } catch {
      // sidebar stays as-is; health banner covers outages
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await checkHealth();
      if (cancelled) return;
      setHealth(ok ? "online" : "offline");
      if (ok) await refreshReports();
      else setReportsLoading(false);
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [refreshReports]);

  const retryHealth = async () => {
    setHealth("checking");
    const ok = await checkHealth();
    setHealth(ok ? "online" : "offline");
    if (ok) {
      setReportsLoading(true);
      await refreshReports();
    }
  };

  const isStreaming = view.kind === "streaming";

  const startResearch = async (e?: FormEvent) => {
    e?.preventDefault();
    const name = query.trim();
    if (!name) {
      setValidation("Please enter a company name first.");
      return;
    }
    setValidation(null);
    setActionError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    const isCurrent = () => runId === runIdRef.current && !controller.signal.aborted;

    setActiveId(null);
    setData(EMPTY_DATA);
    setStatus(IDLE_STATUS);
    setView({ kind: "streaming", company: name });

    let finished = false;

    const onEvent = (ev: StreamEvent) => {
      if (!isCurrent()) return;
      switch (ev.type) {
        case "section_start":
          if (SECTION_ORDER.includes(ev.section)) {
            setStatus((s) => ({ ...s, [ev.section]: "loading" }));
          }
          break;
        case "section_complete":
          if (SECTION_ORDER.includes(ev.section)) {
            setData((d) => ({ ...d, [ev.section]: ev.data as never }));
            setStatus((s) => ({ ...s, [ev.section]: "done" }));
          }
          break;
        case "report_complete":
          finished = true;
          setStatus(DONE_STATUS);
          setActiveId(ev.report_id);
          setView({ kind: "complete", company: ev.company_name || name, createdAt: ev.created_at, id: ev.report_id });
          setReports((prev) => [
            { id: ev.report_id, company_name: ev.company_name || name, created_at: ev.created_at },
            ...prev.filter((r) => r.id !== ev.report_id),
          ]);
          void refreshReports();
          break;
        case "error":
          finished = true;
          controller.abort();
          setView({ kind: "error", message: humanize(ev.message) });
          break;
      }
    };

    try {
      await streamResearch(name, onEvent, controller.signal);
      if (isCurrent() && !finished) {
        setView({ kind: "error", message: "The research stream ended unexpectedly. Please try again." });
      }
    } catch (err) {
      if (controller.signal.aborted || !isCurrent()) return;
      const msg = err instanceof Error && err.message ? err.message : FRIENDLY_ERROR;
      setView({ kind: "error", message: humanize(msg) });
    }
  };

  const openReport = async (id: number) => {
    abortRef.current?.abort();
    const runId = ++runIdRef.current;
    setSidebarOpen(false);
    setActionError(null);
    setActiveId(id);
    setView({ kind: "loading-saved", id });
    setStatus({ ...IDLE_STATUS, overview: "loading", key_people: "loading", news: "loading", financials: "loading", risks: "loading" });
    try {
      const report = await getReport(id);
      if (runId !== runIdRef.current) return;
      setData({
        overview: report.overview ?? null,
        key_people: report.key_people ?? null,
        news: report.news ?? null,
        financials: report.financials ?? null,
        risks: report.risks ?? null,
      });
      setStatus(DONE_STATUS);
      setView({ kind: "complete", company: report.company_name, createdAt: report.created_at, id: report.id });
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setView({ kind: "error", message: err instanceof Error ? err.message : FRIENDLY_ERROR });
    }
  };

  const removeReport = async (id: number) => {
    setActionError(null);
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setView({ kind: "empty" });
        setData(EMPTY_DATA);
        setStatus(IDLE_STATUS);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't delete that report. Please try again.");
    }
  };

  const showReport = view.kind === "streaming" || view.kind === "complete" || view.kind === "loading-saved";
  const headerCompany =
    view.kind === "streaming" || view.kind === "complete"
      ? view.company
      : view.kind === "loading-saved"
        ? (reports.find((r) => r.id === view.id)?.company_name ?? "Loading report…")
        : "";

  return (
    <Page>
      <Header>
        <HeaderRow>
          <BrandWrap>
            <MobileMenuButton type="button" aria-label="Open report history" onClick={() => setSidebarOpen(true)}>
              <History size={16} />
            </MobileMenuButton>
            <BrandMark>R</BrandMark>
            <div>
              <BrandTitle>Research Frontend</BrandTitle>
              <BrandSub>Company Research</BrandSub>
            </div>
          </BrandWrap>
          <StatusPill $health={health}>
            {health === "online" ? "Service online" : health === "offline" ? "Service unreachable" : "Checking service…"}
          </StatusPill>
        </HeaderRow>
      </Header>

      <Layout>
        <Sidebar>
          <SidebarInner>
            <HistorySidebar
              reports={reports}
              activeId={activeId}
              loading={reportsLoading}
              onSelect={(id) => void openReport(id)}
              onDelete={removeReport}
            />
          </SidebarInner>
        </Sidebar>

        {sidebarOpen && (
          <MobileDrawer>
            <MobileBackdrop type="button" aria-label="Close history" onClick={() => setSidebarOpen(false)} />
            <MobilePanel>
              <HistorySidebar
                reports={reports}
                activeId={activeId}
                loading={reportsLoading}
                onSelect={(id) => void openReport(id)}
                onDelete={removeReport}
                onClose={() => setSidebarOpen(false)}
              />
            </MobilePanel>
          </MobileDrawer>
        )}

        <Main>
          {health === "offline" && (
            <HealthBanner>
              <div>
                <strong style={{ display: "block", marginBottom: 4 }}>Couldn't reach the research service.</strong>
                <span style={{ fontSize: "0.75rem", color: "#5f6787" }}>Make sure it's running, then try again.</span>
              </div>
              <SecondaryButton type="button" onClick={() => void retryHealth()}>
                Retry connection
              </SecondaryButton>
            </HealthBanner>
          )}

          <SearchCard as="form" onSubmit={(e) => void startResearch(e)} noValidate>
            <SearchRow>
              <SearchInputWrap>
                <SearchIcon />
                <SearchInput
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (validation) setValidation(null);
                  }}
                  placeholder="Enter a company name..."
                  aria-label="Company name"
                  aria-invalid={validation ? true : undefined}
                  $error={Boolean(validation)}
                />
              </SearchInputWrap>
              <PrimaryButton type="submit" disabled={isStreaming || health === "offline"}>
                {isStreaming ? "Researching…" : "Research"}
              </PrimaryButton>
            </SearchRow>
            {validation && <Message role="alert">{validation}</Message>}
            {isStreaming && (
              <LiveStatus aria-live="polite">
                <span className="skeleton" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%" }} />
                <span>Researching {view.company}… streaming report</span>
              </LiveStatus>
            )}
          </SearchCard>

          {actionError && <Message role="alert">{actionError}</Message>}

          {view.kind === "empty" && (
            <EmptyCard>
              <EmptyIcon>
                <Search size={20} />
              </EmptyIcon>
              <EmptyTitle>Research any company in minutes</EmptyTitle>
              <EmptyText>
                Type a company name above to generate your first report. You&apos;ll get an overview, key
                people, recent news, financials and risks, streamed in live.
              </EmptyText>
            </EmptyCard>
          )}

          {view.kind === "error" && (
            <ErrorCard>
              <ErrorTitle>Something went wrong</ErrorTitle>
              <ErrorText>{view.message}</ErrorText>
              <SecondaryButton type="button" onClick={() => void startResearch()}>
                Try again
              </SecondaryButton>
            </ErrorCard>
          )}

          {showReport && (
            <>
              <ReportHeader>
                <div style={{ minWidth: 0 }}>
                  <ReportMeta>{view.kind === "complete" ? "Report" : "Live report"}</ReportMeta>
                  <ReportName>{headerCompany}</ReportName>
                </div>
                <ReportTime>{view.kind === "complete" ? relativeTime(view.createdAt) || "Just now" : "In progress"}</ReportTime>
              </ReportHeader>
              <ReportSections data={data} status={status} />
            </>
          )}
        </Main>
      </Layout>
    </Page>
  );
}

function humanize(message: string | undefined): string {
  if (!message || typeof message !== "string") return FRIENDLY_ERROR;
  const m = message.trim();
  if (m.length > 240 || /Traceback|Exception|at \w+\.|\n\s+at /.test(m) || /^[A-Z][a-zA-Z]+Error:/.test(m)) {
    return "The research service ran into a problem. Please try again.";
  }
  return m;
}
