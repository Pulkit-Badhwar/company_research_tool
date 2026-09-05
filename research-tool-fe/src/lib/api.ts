import axios from "axios";

export const API_URL: string =
  (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

export type SectionKey = "overview" | "key_people" | "news" | "financials" | "risks";

export const SECTION_ORDER: SectionKey[] = ["overview", "key_people", "news", "financials", "risks"];

export const SECTION_TITLES: Record<SectionKey, string> = {
  overview: "Company Overview",
  key_people: "Key People",
  news: "Recent News",
  financials: "Financial Highlights",
  risks: "Risk Factors",
};

export interface Person {
  name: string;
  title: string;
}

export interface Financials {
  revenue: string | null;
  employee_count: string | null;
  market_cap: string | null;
  yoy_growth: string | null;
}

export interface SectionData {
  overview: string | null;
  key_people: Person[] | null;
  news: string[] | null;
  financials: Financials | null;
  risks: string[] | null;
}

export interface ReportSummary {
  id: number;
  company_name: string;
  created_at: string;
}

export interface FullReport extends ReportSummary, SectionData {}

export type StreamEvent =
  | { type: "section_start"; section: SectionKey }
  | { type: "section_complete"; section: SectionKey; data: unknown }
  | { type: "report_complete"; report_id: number; company_name: string; created_at: string }
  | { type: "error"; message: string };

export const FRIENDLY_ERROR = "Couldn't reach the research service. Please try again.";

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await api.get("/api/health");
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

export async function listReports(): Promise<ReportSummary[]> {
  try {
    const res = await api.get<ReportSummary[]>("/api/reports");
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    throw new Error(FRIENDLY_ERROR);
  }
}

export async function getReport(id: number): Promise<FullReport> {
  try {
    const res = await api.get<FullReport>(`/api/reports/${id}`);
    return res.data;
  } catch {
    throw new Error("We couldn't load that report. It may have been deleted.");
  }
}

export async function deleteReport(id: number): Promise<void> {
  try {
    await api.delete(`/api/reports/${id}`);
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status !== 404) {
      throw new Error("Couldn't delete that report. Please try again.");
    }
  }
}

export async function streamResearch(
  companyName: string,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  try {
    // Browser Axios cannot expose a ReadableStream with responseType "stream".
    // Keep Axios for JSON APIs, and use fetch for this POST SSE stream.
    const res = await fetch(`${API_URL}/api/research`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ company_name: companyName }),
      signal,
    });

    if (!res.ok || !res.body) {
      let message = FRIENDLY_ERROR;
      try {
        const body = (await res.json()) as { message?: string; detail?: string };
        if (typeof body.message === "string") message = body.message;
        else if (typeof body.detail === "string") message = body.detail;
      } catch {
        // Keep the friendly fallback when the error body is not JSON.
      }
      throw new Error(message);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const dispatch = (raw: string) => {
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length === 0) return;
      try {
        const parsed = JSON.parse(dataLines.join("\n")) as StreamEvent;
        if (parsed && typeof parsed === "object" && "type" in parsed) onEvent(parsed);
      } catch {
        // ignore malformed SSE frames
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        dispatch(frame);
      }
    }

    if (buffer.trim()) dispatch(buffer);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }

    const message = error instanceof Error && error.message ? error.message : FRIENDLY_ERROR;
    throw new Error(message);
  }
}
