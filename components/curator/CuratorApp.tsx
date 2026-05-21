"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  generateSongList,
  getJobStatus,
  startPlaylistConversion,
  startUrlConversion,
} from "@/app/actions";
import { InputScreen } from "@/components/curator/InputScreen";
import { ListConfirmScreen } from "@/components/curator/ListConfirmScreen";
import { ProgressScreen } from "@/components/curator/ProgressScreen";
import type { JobStatus, Song } from "@/types/song";

type Mode = { kind: "input" } | { kind: "list" } | { kind: "progress"; jobId: string };

const POLL_INTERVAL_MS = 1000;
const DEFAULT_COUNT = 10;

export function CuratorApp() {
  const [mode, setMode] = useState<Mode>({ kind: "input" });

  // Taste-mode input state, preserved across "입력 수정".
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(DEFAULT_COUNT);

  // List-mode state.
  const [songs, setSongs] = useState<Song[]>([]);
  const [requestedCount, setRequestedCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [listError, setListError] = useState<string | undefined>(undefined);

  // Progress-mode state.
  const [job, setJob] = useState<JobStatus | null>(null);
  const downloadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (mode.kind !== "progress") {
      setJob(null);
      downloadedRef.current.clear();
      return;
    }
    const jobId = mode.jobId;
    let cancelled = false;

    async function tick() {
      const status = await getJobStatus(jobId);
      if (cancelled || !status) return;
      setJob(status);

      status.items.forEach((item, i) => {
        if (item.status !== "done") return;
        const key = `${jobId}:${i}`;
        if (downloadedRef.current.has(key)) return;
        downloadedRef.current.add(key);
        const a = document.createElement("a");
        a.href = `/api/download/${jobId}/${i}`;
        a.download = item.downloadName ?? "";
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    }

    void tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mode]);

  const handleGenerateList = useCallback(async () => {
    setGenerating(true);
    setListError(undefined);
    try {
      const result = await generateSongList(query, count);
      if (!result.ok) {
        setListError(
          result.reason === "llm-failed"
            ? "LLM 호출이 실패했습니다. 잠시 후 다시 시도해주세요."
            : "취향을 입력해주세요.",
        );
        return;
      }
      if (result.songs.length === 0) {
        setListError("매칭되는 영상을 찾지 못했습니다. 취향을 더 구체적으로 적어보세요.");
        return;
      }
      setSongs(result.songs);
      setRequestedCount(result.requested);
      setMode({ kind: "list" });
    } finally {
      setGenerating(false);
    }
  }, [query, count]);

  const handleSubmitUrl = useCallback(async (url: string) => {
    const result = await startUrlConversion(url);
    if (!result.ok) {
      if (result.reason === "busy") {
        toast.error("이미 변환이 진행 중입니다");
      } else {
        toast.error("유효한 YouTube URL이 아닙니다");
      }
      return;
    }
    setMode({ kind: "progress", jobId: result.jobId });
  }, []);

  const handleEditInput = useCallback(() => {
    setMode({ kind: "input" });
    setListError(undefined);
  }, []);

  const handleStartDownload = useCallback(async (selected: Song[]) => {
    const result = await startPlaylistConversion(selected);
    if (!result.ok) {
      toast.error(
        result.reason === "busy" ? "이미 변환이 진행 중입니다" : "곡 목록이 비어 있습니다",
      );
      return;
    }
    setMode({ kind: "progress", jobId: result.jobId });
  }, []);

  const handleReset = useCallback(() => {
    setMode({ kind: "input" });
  }, []);

  if (mode.kind === "list") {
    return (
      <ListConfirmScreen
        query={query}
        songs={songs}
        requested={requestedCount}
        regenerating={generating}
        onStartDownload={handleStartDownload}
        onRegenerate={handleGenerateList}
        onEditInput={handleEditInput}
      />
    );
  }

  if (mode.kind === "progress") {
    if (!job) {
      return (
        <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
          시작 중…
        </div>
      );
    }
    return <ProgressScreen job={job} onReset={handleReset} />;
  }

  return (
    <InputScreen
      query={query}
      count={count}
      onQueryChange={setQuery}
      onCountChange={setCount}
      onGenerateList={handleGenerateList}
      onSubmitUrl={handleSubmitUrl}
      disabled={false}
      generating={generating}
      errorMessage={listError}
    />
  );
}
