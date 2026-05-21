"use client";

import { useState } from "react";
import {
  RiAlertLine,
  RiDownloadLine,
  RiMusic2Line,
  RiPlayListLine,
  RiRefreshLine,
} from "@remixicon/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

const MIN_COUNT = 1;
const MAX_COUNT = 50;

type Props = {
  query: string;
  count: number;
  onQueryChange: (v: string) => void;
  onCountChange: (v: number) => void;
  onGenerateList: () => Promise<void>;
  onSubmitUrl: (url: string) => Promise<void>;
  /** Generic external disable (e.g. another job actively running). */
  disabled: boolean;
  /** True while the song-list LLM call is in flight. */
  generating: boolean;
  /** Non-null when the last list-generation attempt failed. */
  errorMessage?: string;
};

function clampCount(raw: number): number {
  if (Number.isNaN(raw)) return MIN_COUNT;
  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.floor(raw)));
}

export function InputScreen({
  query,
  count,
  onQueryChange,
  onCountChange,
  onGenerateList,
  onSubmitUrl,
  disabled,
  generating,
  errorMessage,
}: Props) {
  const [url, setUrl] = useState("");
  const [submittingUrl, setSubmittingUrl] = useState(false);

  const queryTrimmed = query.trim();
  const tasteDisabled = disabled || generating || submittingUrl;
  const urlDisabled = disabled || generating || submittingUrl;

  const canGenerate = !tasteDisabled && queryTrimmed.length > 0;
  const urlInvalid = url.length > 0 && !/^https?:\/\//.test(url);
  const canSubmitUrl = !urlDisabled && url.length > 0 && !urlInvalid;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!canGenerate) return;
    await onGenerateList();
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitUrl) return;
    setSubmittingUrl(true);
    try {
      await onSubmitUrl(url.trim());
    } finally {
      setSubmittingUrl(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center gap-2">
        <RiMusic2Line className="size-5 text-foreground" aria-hidden />
        <div>
          <h1 className="text-xl font-bold">MP3 Curator</h1>
          <p className="text-sm text-muted-foreground">취향 한 줄로 듣고 싶은 곡들을 mp3로</p>
        </div>
      </header>

      {errorMessage && (
        <Alert variant="destructive">
          <RiAlertLine />
          <AlertTitle>곡 목록을 만들 수 없습니다</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* 취향 모드 */}
      <form onSubmit={handleGenerate} className="space-y-4 rounded-md border border-border bg-card p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          취향으로 받기
        </div>

        <div className="space-y-1">
          <Label htmlFor="curator-query">어떤 곡을 듣고 싶으세요?</Label>
          <Input
            id="curator-query"
            type="text"
            placeholder="예: 여성 20대가 좋아하는 최신 댄스곡"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            disabled={tasteDisabled}
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="space-y-1">
            <Label htmlFor="curator-count">곡 수 ({MIN_COUNT}–{MAX_COUNT})</Label>
            <Input
              id="curator-count"
              type="number"
              min={MIN_COUNT}
              max={MAX_COUNT}
              className="w-24"
              value={count}
              onChange={(e) => onCountChange(clampCount(Number(e.target.value)))}
              disabled={tasteDisabled}
            />
          </div>
          <Button type="submit" className="md:ml-auto" disabled={!canGenerate}>
            {generating ? (
              <Spinner data-icon="inline-start" />
            ) : errorMessage ? (
              <RiRefreshLine data-icon="inline-start" />
            ) : (
              <RiPlayListLine data-icon="inline-start" />
            )}
            {errorMessage ? "다시 시도" : "곡 목록 만들기"}
          </Button>
        </div>
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">또는</span>
        <Separator className="flex-1" />
      </div>

      {/* URL 모드 */}
      <form onSubmit={handleUrlSubmit} className="space-y-3 rounded-md border border-border bg-card p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          URL로 받기
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="curator-url">YouTube 영상 URL</Label>
            <Input
              id="curator-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={urlDisabled}
              aria-invalid={urlInvalid || undefined}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!canSubmitUrl}>
            {submittingUrl ? <Spinner data-icon="inline-start" /> : <RiDownloadLine data-icon="inline-start" />}
            변환
          </Button>
        </div>
      </form>
    </div>
  );
}
