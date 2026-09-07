import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { History, Search } from "lucide-react";
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
import "./index.scss";

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
    <div className="page">
      <header className="header">
        <div className="header-row">
          <div className="brand-wrap">
            <button className="mobile-menu-button" type="button" aria-label="Open report history" onClick={() => setSidebarOpen(true)}>
              <History size={16} />
            </button>
            <div className="brand-mark">R</div>
            <div>
              <p className="brand-title">Research Frontend</p>
              <p className="brand-sub">Company Research</p>
            </div>
          </div>
          <div className={`status-pill ${health}`}>
            {health === "online" ? "Service online" : health === "offline" ? "Service unreachable" : "Checking service…"}
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <HistorySidebar
              reports={reports}
              activeId={activeId}
              loading={reportsLoading}
              onSelect={(id) => void openReport(id)}
              onDelete={removeReport}
            />
          </div>
        </aside>

        {sidebarOpen && (
          <div className="mobile-drawer">
            <button className="mobile-backdrop" type="button" aria-label="Close history" onClick={() => setSidebarOpen(false)} />
            <div className="mobile-panel">
              <HistorySidebar
                reports={reports}
                activeId={activeId}
                loading={reportsLoading}
                onSelect={(id) => void openReport(id)}
                onDelete={removeReport}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        <main className="main">
          {health === "offline" && (
            <div className="box health-banner">
              <div>
                <strong className="block-message">Couldn't reach the research service.</strong>
                <span className="health-help">Make sure it's running, then try again.</span>
              </div>
              <button className="secondary-button" type="button" onClick={() => void retryHealth()}>
                Retry connection
              </button>
            </div>
          )}

          <form className="box search-card" onSubmit={(e) => void startResearch(e)} noValidate>
            <div className="search-row">
              <div className="search-input-wrap">
                <Search className="search-icon" />
                <input
                  className={`search-input${validation ? " error" : ""}`}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (validation) setValidation(null);
                  }}
                  placeholder="Enter a company name..."
                  aria-label="Company name"
                  aria-invalid={validation ? true : undefined}
                />
              </div>
              <button className="primary-button" type="submit" disabled={isStreaming || health === "offline"}>
                {isStreaming ? "Researching…" : "Research"}
              </button>
            </div>
            {validation && <p className="message" role="alert">{validation}</p>}
            {isStreaming && (
              <div className="live-status" aria-live="polite">
                <span className="skeleton" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%" }} />
                <span>Researching {view.company}… streaming report</span>
              </div>
            )}
          </form>

          {actionError && <p className="message" role="alert">{actionError}</p>}

          {view.kind === "empty" && (
            <div className="box empty-card">
              <div className="empty-icon">
                <Search size={20} />
              </div>
              <h1 className="empty-title">Research any company in minutes</h1>
              <p className="empty-text">
                Type a company name above to generate your first report. You&apos;ll get an overview, key
                people, recent news, financials and risks, streamed in live.
              </p>
            </div>
          )}

          {view.kind === "error" && (
            <div className="box error-card">
              <h1 className="error-title">Something went wrong</h1>
              <p className="error-text">{view.message}</p>
              <button className="secondary-button" type="button" onClick={() => void startResearch()}>
                Try again
              </button>
            </div>
          )}

          {showReport && (
            <>
              <div className="report-header">
                <div className="inline-content">
                  <p className="report-meta">{view.kind === "complete" ? "Report" : "Live report"}</p>
                  <h1 className="report-name">{headerCompany}</h1>
                </div>
                <span className="report-time">{view.kind === "complete" ? relativeTime(view.createdAt) || "Just now" : "In progress"}</span>
              </div>
              <ReportSections data={data} status={status} />
            </>
          )}
        </main>
      </div>
    </div>
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
