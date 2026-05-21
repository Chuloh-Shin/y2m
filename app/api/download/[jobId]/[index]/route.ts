import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getJob } from "@/lib/jobs";

type RouteParams = { params: Promise<{ jobId: string; index: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { jobId, index } = await params;
  const job = getJob(jobId);
  const item = job?.items[Number(index)];
  if (!job || !item || item.status !== "done" || !item.filePath) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Defense in depth: filePath comes from yt-dlp, but ensure we only stream
  // files we placed in the OS temp dir for this app.
  const resolved = path.resolve(item.filePath);
  if (!resolved.startsWith(path.resolve(tmpdir()))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const stats = await stat(item.filePath);
    const nodeStream = createReadStream(item.filePath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(stats.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(item.downloadName ?? "audio.mp3")}`,
      },
    });
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }
}
