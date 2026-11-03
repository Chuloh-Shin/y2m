import { describe, expect, it } from "vitest";
import { parseMelonChart } from "./melon";

function row(rank: number, title: string, artistsHtml: string, cls = "lst50") {
  return `<tr class="${cls}" id="${cls}" data-song-no="1">
    <td><div class="wrap t_center"><span class="rank ">${rank}</span><span class="none">위</span></div></td>
    <td><div class="wrap_song_info">
      <div class="ellipsis rank01"><span>
        <a href="javascript:melon.play.playSong('1',1);" title="${title} 재생">${title}</a>
      </span></div><br>
      <div class="ellipsis rank02">
        ${artistsHtml}<span class="checkEllipsis" style="display:none">${artistsHtml}</span>
      </div>
    </div></td>
  </tr>`;
}

const a = (name: string) => `<a href="/artist/detail.htm?artistId=1" title="${name} - 페이지 이동">${name}</a>`;

describe("parseMelonChart", () => {
  it("extracts rank, title and artist from lst50 and lst100 rows", () => {
    const html = `<table>${row(1, "With", a("RESCENE&nbsp;(리센느)"))}${row(51, "Drama", a("aespa"), "lst100")}</table>`;
    expect(parseMelonChart(html)).toEqual([
      { rank: 1, title: "With", artist: "RESCENE (리센느)" },
      { rank: 51, title: "Drama", artist: "aespa" },
    ]);
  });

  it("joins multiple artists with a comma", () => {
    const html = row(2, "NEON", `${a("A2O")}, ${a("A2O&nbsp;LITE")}`);
    expect(parseMelonChart(html)).toEqual([
      { rank: 2, title: "NEON", artist: "A2O, A2O LITE" },
    ]);
  });

  it("decodes HTML entities in titles", () => {
    const html = row(3, "Rock &amp; Roll It&#39;s Me", a("ILLIT"));
    expect(parseMelonChart(html)[0].title).toBe("Rock & Roll It's Me");
  });

  it("returns [] when the markup has no chart rows", () => {
    expect(parseMelonChart("<html><body>점검 중</body></html>")).toEqual([]);
  });
});
