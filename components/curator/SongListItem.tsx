"use client";

import { RiExternalLinkLine, RiImageLine } from "@remixicon/react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  artist: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
};

export function SongListItem({
  title,
  artist,
  youtubeUrl,
  thumbnailUrl,
  checked,
  onCheckedChange,
}: Props) {
  return (
    <li
      data-testid="song-list-item"
      data-checked={checked}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-card p-3",
        !checked && "opacity-50",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        aria-label={`${title} 선택`}
      />

      <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
        {thumbnailUrl ? (
          // Using native <img> to avoid Next.js remotePatterns setup for arbitrary
          // YouTube CDN hosts; Image optimization is not critical for a local tool.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <RiImageLine className="size-4 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-sm",
            !checked && "line-through",
          )}
        >
          {title}
        </div>
        <div className="truncate text-xs text-muted-foreground">{artist}</div>
      </div>

      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
      >
        <RiExternalLinkLine className="size-3" aria-hidden />
        <span className="hidden md:inline">미리 듣기</span>
      </a>
    </li>
  );
}
