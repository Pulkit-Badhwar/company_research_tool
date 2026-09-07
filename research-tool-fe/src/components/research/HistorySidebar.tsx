import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, X } from "lucide-react";
import type { ReportSummary } from "@/lib/api";
import "./HistorySidebar.scss";

interface Props {
  reports: ReportSummary[];
  activeId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => Promise<void> | void;
  onClose?: () => void;
}

export function relativeTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function HistorySidebar({ reports, activeId, loading, onSelect, onDelete, onClose }: Props) {
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="sidebar-card">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Report History</h2>
        <div className="inline-row">
          <span className="count-pill">{reports.length}</span>
          {onClose && (
            <button className="close-button" type="button" onClick={onClose} aria-label="Close history">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading && reports.length === 0 ? (
        <ul className="report-list">
          {[0, 1, 2].map((i) => (
            <li className="report-item" key={i}>
              <div className="skeleton" style={{ width: "70%", height: 12, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: "35%", height: 10, borderRadius: 999, marginTop: 8 }} />
            </li>
          ))}
        </ul>
      ) : reports.length === 0 ? (
        <p className="empty-state">No reports yet. Your finished reports will show up here.</p>
      ) : (
        <ul className="report-list">
          {reports.map((r) => {
            const active = r.id === activeId;
            const confirming = confirmId === r.id;
            return (
              <li className={`report-item${active ? " active" : ""}`} key={r.id}>
                {confirming ? (
                  <div className="confirm-wrap">
                    <p className="confirm-text">
                      Delete <strong>{r.company_name}</strong>? This can&apos;t be undone.
                    </p>
                    <div className="confirm-actions">
                      <button className="danger-button" type="button" disabled={deletingId === r.id} onClick={() => void handleDelete(r.id)}>
                        {deletingId === r.id ? "Deleting…" : "Delete"}
                      </button>
                      <button className="cancel-button" type="button" onClick={() => setConfirmId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="report-row">
                    <button className="report-line" type="button" onClick={() => onSelect(r.id)}>
                      <p className={`company-name${active ? " active" : ""}`}>{r.company_name}</p>
                      <p className="relative-time">{relativeTime(r.created_at)}</p>
                    </button>
                    <button
                      className="delete-action"
                      type="button"
                      aria-label={`Delete report for ${r.company_name}`}
                      onClick={() => setConfirmId(r.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
