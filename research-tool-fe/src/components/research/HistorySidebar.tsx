import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, X } from "lucide-react";
import { styled, css } from "styled-components";
import type { ReportSummary } from "@/lib/api";

interface Props {
  reports: ReportSummary[];
  activeId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => Promise<void> | void;
  onClose?: () => void;
}

const SidebarCard = styled.div`
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 7rem);
  padding: 1.25rem;
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow: 0 18px 38px rgba(28, 26, 54, 0.06);
  backdrop-filter: blur(20px);
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const SidebarTitle = styled.h2`
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

const CountPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: rgba(90, 70, 217, 0.1);
  color: #4337b8;
`;

const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 0.6rem;
  background: rgba(255, 255, 255, 0.48);
  color: #5f6787;
  padding: 0;
  cursor: pointer;
`;

const ReportList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const ReportItem = styled.li<{ $active: boolean }>`
  border: 1px solid ${({ $active }) => ($active ? "rgba(90, 70, 217, 0.22)" : "transparent")};
  border-radius: 1rem;
  background: ${({ $active }) => ($active ? "rgba(90, 70, 217, 0.08)" : "rgba(255, 255, 255, 0.45)")};
  padding: 0.8rem 0.8rem;
  transition: all 0.2s ease;
`;

const DeleteAction = styled.button<{ $visible?: boolean }>`
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  color: #5f6787;
  cursor: pointer;
  padding: 0.35rem;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.7);
    color: #d86363;
  }
`;

const ReportLine = styled.button`
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  width: 100%;
  color: inherit;
  cursor: pointer;
`;

const CompanyName = styled.p<{ $active: boolean }>`
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
  font-weight: ${({ $active }) => ($active ? 700 : 600)};
`;

const RelativeTime = styled.p`
  margin: 0.25rem 0 0;
  color: #5f6787;
  font-size: 0.72rem;
`;

const EmptyState = styled.p`
  margin: 0;
  padding: 1.1rem;
  border: 1px dashed rgba(255, 255, 255, 0.8);
  border-radius: 1rem;
  text-align: center;
  font-size: 0.72rem;
  color: #5f6787;
  line-height: 1.6;
`;

const ConfirmWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;

const ConfirmText = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: #1a1d2d;
  line-height: 1.6;
`;

const ConfirmActions = styled.div`
  display: flex;
  gap: 0.55rem;
`;

const DangerButton = styled.button`
  border: none;
  border-radius: 0.7rem;
  background: #d86363;
  color: white;
  padding: 0.45rem 0.8rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
`;

const CancelButton = styled.button`
  border: none;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.5);
  color: #5f6787;
  padding: 0.45rem 0.8rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
`;

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
    <SidebarCard>
      <SidebarHeader>
        <SidebarTitle>Report History</SidebarTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CountPill>{reports.length}</CountPill>
          {onClose && (
            <CloseButton type="button" onClick={onClose} aria-label="Close history">
              <X size={14} />
            </CloseButton>
          )}
        </div>
      </SidebarHeader>

      {loading && reports.length === 0 ? (
        <ReportList>
          {[0, 1, 2].map((i) => (
            <ReportItem key={i} $active={false}>
              <div className="skeleton" style={{ width: "70%", height: 12, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: "35%", height: 10, borderRadius: 999, marginTop: 8 }} />
            </ReportItem>
          ))}
        </ReportList>
      ) : reports.length === 0 ? (
        <EmptyState>No reports yet. Your finished reports will show up here.</EmptyState>
      ) : (
        <ReportList>
          {reports.map((r) => {
            const active = r.id === activeId;
            const confirming = confirmId === r.id;
            return (
              <ReportItem key={r.id} $active={active}>
                {confirming ? (
                  <ConfirmWrap>
                    <ConfirmText>
                      Delete <strong>{r.company_name}</strong>? This can&apos;t be undone.
                    </ConfirmText>
                    <ConfirmActions>
                      <DangerButton type="button" disabled={deletingId === r.id} onClick={() => void handleDelete(r.id)}>
                        {deletingId === r.id ? "Deleting…" : "Delete"}
                      </DangerButton>
                      <CancelButton type="button" onClick={() => setConfirmId(null)}>
                        Cancel
                      </CancelButton>
                    </ConfirmActions>
                  </ConfirmWrap>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <ReportLine type="button" onClick={() => onSelect(r.id)}>
                      <CompanyName $active={active}>{r.company_name}</CompanyName>
                      <RelativeTime>{relativeTime(r.created_at)}</RelativeTime>
                    </ReportLine>
                    <DeleteAction
                      type="button"
                      aria-label={`Delete report for ${r.company_name}`}
                      $visible={true}
                      onClick={() => setConfirmId(r.id)}
                    >
                      <Trash2 size={14} />
                    </DeleteAction>
                  </div>
                )}
              </ReportItem>
            );
          })}
        </ReportList>
      )}
    </SidebarCard>
  );
}
