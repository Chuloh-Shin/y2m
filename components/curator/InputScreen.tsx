"use client";

import { useState } from "react";
import { RiDownloadLine, RiMusic2Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  onSubmitUrl: (url: string) => Promise<void>;
  disabled: boolean;
};

export function InputScreen({ onSubmitUrl, disabled }: Props) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const urlInvalid = url.length > 0 && !/^https?:\/\//.test(url);
  const canSubmitUrl = !disabled && !submitting && url.length > 0 && !urlInvalid;

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitUrl) return;
    setSubmitting(true);
    try {
      await onSubmitUrl(url.trim());
    } finally {
      setSubmitting(false);
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
              disabled={disabled || submitting}
              aria-invalid={urlInvalid || undefined}
            />
          </div>
          <Button type="submit" disabled={!canSubmitUrl}>
            {submitting ? <Spinner data-icon="inline-start" /> : <RiDownloadLine data-icon="inline-start" />}
            변환
          </Button>
        </div>
      </form>
    </div>
  );
}
