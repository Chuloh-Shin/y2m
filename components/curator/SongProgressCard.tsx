import { RiCheckLine, RiCloseLine, RiSearchLine, RiDownloadLine } from "@remixicon/react";
import { Spinner } from "@/components/ui/spinner";
import type { SongJobItem, SongStatus } from "@/types/song";

const STATUS_LABEL: Record<SongStatus, string> = {
  pending: "대기",
  searching: "검색 중",
  downloading: "다운로드 중",
  converting: "변환 중",
  done: "완료",
  failed: "실패",
};

function StatusIcon({ status }: { status: SongStatus }) {
  if (status === "done") return <RiCheckLine className="size-5 text-foreground" aria-hidden />;
  if (status === "failed") return <RiCloseLine className="size-5 text-muted-foreground" aria-hidden />;
  if (status === "searching") return <RiSearchLine className="size-5 text-muted-foreground" aria-hidden />;
  if (status === "downloading") return <RiDownloadLine className="size-5 text-muted-foreground" aria-hidden />;
  if (status === "converting") return <Spinner className="size-5" />;
  return <Spinner className="size-5 opacity-50" />;
}

export function SongProgressCard({ item }: { item: SongJobItem }) {
  const subLine =
    item.status === "failed" && item.failureReason
      ? `${item.artist || "—"} · 실패 — ${item.failureReason}`
      : item.artist
        ? `${item.artist} · ${STATUS_LABEL[item.status]}`
        : STATUS_LABEL[item.status];

  return (
    <li
      data-testid="song-progress-card"
      data-status={item.status}
      className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
    >
      <StatusIcon status={item.status} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{item.title || item.youtubeUrl}</div>
        <div className="truncate text-xs text-muted-foreground">{subLine}</div>
      </div>
    </li>
  );
}
