"use client";

import { RiArrowLeftLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SongProgressCard } from "@/components/curator/SongProgressCard";
import type { JobStatus } from "@/types/song";
import { isTerminal } from "@/types/song";

type Props = {
  job: JobStatus;
  onReset: () => void;
};

export function ProgressScreen({ job, onReset }: Props) {
  const completed = job.items.filter((it) => it.status === "done").length;
  const failed = job.items.filter((it) => it.status === "failed").length;
  const inProgress = job.items.filter((it) => !isTerminal(it.status)).length;
  const total = job.items.length;
  const terminated = job.terminated;
  const percent = total === 0 ? 0 : Math.round(((completed + failed) / total) * 100);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-lg font-bold">{terminated ? "변환 완료" : "변환 진행"}</h1>
        <p className="text-xs text-muted-foreground">
          {terminated
            ? `${completed} 완료 · ${failed} 실패`
            : `${completed} 완료 · ${failed} 실패 · ${inProgress} 진행 중`}
        </p>
        <div data-testid="overall-progress" data-percent={percent}>
          <Progress value={percent} aria-label="전체 진행률" />
        </div>
      </header>

      <ul className="space-y-2">
        {job.items.map((item, i) => (
          <SongProgressCard key={i} item={item} />
        ))}
      </ul>

      <Button onClick={onReset} disabled={!terminated} variant={terminated ? "default" : "outline"}>
        <RiArrowLeftLine data-icon="inline-start" />
        새 입력으로
      </Button>
    </div>
  );
}
