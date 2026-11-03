import { describe, expect, it } from "vitest";
import { buildYtDlpArgs, LOUDNORM_FILTER } from "./converter";

describe("buildYtDlpArgs", () => {
  const args = buildYtDlpArgs("https://www.youtube.com/watch?v=x", "/tmp/job/%(title)s.%(ext)s", "ffmpeg");

  it("normalizes loudness to -14 LUFS during audio extraction", () => {
    const i = args.indexOf("--postprocessor-args");
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe("ExtractAudio+ffmpeg_o:-af loudnorm=I=-14:TP=-1.5:LRA=11");
    expect(LOUDNORM_FILTER).toContain("I=-14");
  });

  it("still extracts best-quality mp3 and ends with the URL", () => {
    expect(args.slice(0, 5)).toEqual(["-x", "--audio-format", "mp3", "--audio-quality", "0"]);
    expect(args.at(-1)).toBe("https://www.youtube.com/watch?v=x");
  });
});
