import { describe, expect, it } from "vitest";
import { parseMelonChart, parseSongGenre } from "./melon";

function row(
  rank: number,
  title: string,
  artistsHtml: string,
  cls = "lst50",
  imgStamp?: string,
) {
  const img = imgStamp
    ? `<td><a href="/album/detail.htm?albumId=1"><img src="https://cdnimg.melon.co.kr/cm2/album/images/150/82/293/15082293_${imgStamp}_500.jpg/melon/resize/120/quality/80/optimize"/></a></td>`
    : "";
  return `<tr class="${cls}" id="${cls}" data-song-no="${rank}00">
    <td><div class="wrap t_center"><span class="rank ">${rank}</span><span class="none">위</span></div></td>
    ${img}
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
      { rank: 1, title: "With", artist: "RESCENE (리센느)", songId: "100" },
      { rank: 51, title: "Drama", artist: "aespa", songId: "5100" },
    ]);
  });

  it("joins multiple artists with a comma", () => {
    const html = row(2, "NEON", `${a("A2O")}, ${a("A2O&nbsp;LITE")}`);
    expect(parseMelonChart(html)).toEqual([
      { rank: 2, title: "NEON", artist: "A2O, A2O LITE", songId: "200" },
    ]);
  });

  it("decodes HTML entities in titles", () => {
    const html = row(3, "Rock &amp; Roll It&#39;s Me", a("ILLIT"));
    expect(parseMelonChart(html)[0].title).toBe("Rock & Roll It's Me");
  });

  it("reads the approximate release date from the album art URL", () => {
    const html = row(80, "Whiplash", a("aespa"), "lst100", "20241018093012");
    expect(parseMelonChart(html)[0]).toEqual({
      rank: 80,
      title: "Whiplash",
      artist: "aespa",
      songId: "8000",
      releasedOn: "2024-10-18",
    });
  });

  it("leaves releasedOn undefined when the album art has no timestamp", () => {
    expect(parseMelonChart(row(5, "X", a("Y")))[0].releasedOn).toBeUndefined();
  });

  it("returns [] when the markup has no chart rows", () => {
    expect(parseMelonChart("<html><body>점검 중</body></html>")).toEqual([]);
  });
});

describe("parseSongGenre", () => {
  it("reads the genre from a song detail page", () => {
    const html = `<dl class="list">
							<dt>앨범</dt>
							<dd><a href="javascript:melon.link.goAlbumDetail('15082293');">PULSE</a></dd>
							<dt>발매일</dt>
							<dd>2026.11.03</dd>
							<dt>장르</dt>
							<dd>댄스</dd>
						</dl>`;
    expect(parseSongGenre(html)).toBe("댄스");
  });

  it("decodes entities such as R&amp;B/Soul", () => {
    expect(parseSongGenre("<dt>장르</dt><dd>R&amp;B/Soul</dd>")).toBe("R&B/Soul");
  });

  it("returns undefined when there is no genre field", () => {
    expect(parseSongGenre("<dt>발매일</dt><dd>2026.11.03</dd>")).toBeUndefined();
  });
});
