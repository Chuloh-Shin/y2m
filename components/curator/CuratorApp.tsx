"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getJobStatus, startUrlConversion } from "@/app/actions";
import { InputScreen } from "@/components/curator/InputScreen";
import { ProgressScreen } from "@/components/curator/ProgressScreen";
import type { JobStatus } from "@/types/song";

type Mode = { kind: "input" } | { kind: "progress"; jobId: string };

const POLL_INTERVAL_MS = 1000;

export function CuratorApp() {
  const [mode, setMode] = useState<Mode>({ kind: "input" });
  const [job, setJob] = useState<JobStatus | null>(null);
  const downloadedRef = useRef<Set<string>>(new Set());

  // Poll job status while in progress mode.
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

      // Trigger browser downloads for newly-done items.
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

  const handleReset = useCallback(() => {
    setMode({ kind: "input" });
  }, []);

  if (mode.kind === "progress" && job) {
    return <ProgressScreen job={job} onReset={handleReset} />;
  }
  return <InputScreen onSubmitUrl={handleSubmitUrl} disabled={false} />;
}
