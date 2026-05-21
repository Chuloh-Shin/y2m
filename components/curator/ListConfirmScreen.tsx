"use client";

import { useState } from "react";
import {
  RiArrowLeftLine,
  RiDownloadLine,
  RiEditLine,
  RiRefreshLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { SongListItem } from "@/components/curator/SongListItem";
import type { Song } from "@/types/song";

type Props = {
  query: string;
  songs: Song[];
  /** Number the user asked for. If `> songs.length`, some matches were dropped. */
  requested: number;
  regenerating: boolean;
  onStartDownload: (selected: Song[]) => void;
  onRegenerate: () => Promise<void>;
  onEditInput: () => void;
};

export function ListConfirmScreen({
  query,
  songs,
  requested,
  regenerating,
  onStartDownload,
  onRegenerate,
  onEditInput,
}: Props) {
  const droppedCount = Math.max(0, requested - songs.length);
  const [trackedSongs, setTrackedSongs] = useState(songs);
  const [checkedMask, setCheckedMask] = useState<boolean[]>(() =>
    new Array(songs.length).fill(true),
  );

  // Reset the mask whenever the songs prop reference changes (regenerate or
  // first mount of a new list). Identity comparison avoids the bug where a
  // same-length new list inherits the previous unchecked indices.
  if (trackedSongs !== songs) {
    setTrackedSongs(songs);
    setCheckedMask(new Array(songs.length).fill(true));
  }

  const selectedCount = checkedMask.filter(Boolean).length;
  const total = songs.length;

  function toggle(i: number, next: boolean) {
    setCheckedMask((prev) => prev.map((v, idx) => (idx === i ? next : v)));
  }

  function handleStart() {
    const selected = songs.filter((_, i) => checkedMask[i]);
    if (selected.length === 0) return;
    onStartDownload(selected);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-2">
        <button
          type="button"
          onClick={onEditInput}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RiArrowLeftLine className="size-3" aria-hidden />
          입력 수정
        </button>
        <h1 className="text-lg font-bold">곡 목록 확인</h1>
        <p className="text-xs text-muted-foreground">&quot;{query}&quot;</p>
        <p className="text-xs">
          <span className="text-foreground">
            {total}곡 중 {selectedCount}곡 선택됨
          </span>
          <span className="text-muted-foreground">
            {" · "}썸네일·링크로 미리 들어보고 빼고 싶은 곡은 체크 해제
          </span>
        </p>
        {droppedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            요청한 {requested}곡 중 {droppedCount}곡은 YouTube에서 매칭을 찾지 못해 목록에서 제외했습니다.
          </p>
        )}
      </header>

      <ol className="space-y-2">
        {songs.map((song, i) => (
          <SongListItem
            key={`${song.youtubeUrl}-${i}`}
            title={song.title}
            artist={song.artist}
            youtubeUrl={song.youtubeUrl}
            thumbnailUrl={song.thumbnailUrl}
            checked={checkedMask[i] ?? true}
            onCheckedChange={(v) => toggle(i, v)}
          />
        ))}
      </ol>

      <div className="flex flex-col gap-2 md:flex-row">
        <Button onClick={handleStart} disabled={selectedCount === 0 || regenerating}>
          <RiDownloadLine data-icon="inline-start" />
          다운로드 시작 ({selectedCount}곡)
        </Button>
        <Button variant="outline" onClick={onRegenerate} disabled={regenerating}>
          <RiRefreshLine data-icon="inline-start" />
          다시 생성
        </Button>
        <Button variant="outline" onClick={onEditInput} disabled={regenerating}>
          <RiEditLine data-icon="inline-start" />
          입력 수정
        </Button>
      </div>
    </div>
  );
}
