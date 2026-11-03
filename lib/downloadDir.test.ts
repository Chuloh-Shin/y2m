import path from "node:path";
import { describe, expect, it } from "vitest";
import { businessDate, resolveDownloadDir } from "./downloadDir";

const HOME = "C:/Users/me";
// Local-time constructors, so the tests do not depend on the machine's zone.
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi);

describe("businessDate", () => {
  it("formats the local calendar date as YYYYMMDD", () => {
    expect(businessDate(at(2026, 11, 4, 15), 0)).toBe("20261104");
  });

  it("counts hours before dayStartHour as the previous day", () => {
    expect(businessDate(at(2026, 11, 4, 0, 32), 6)).toBe("20261103");
    expect(businessDate(at(2026, 11, 4, 5, 59), 6)).toBe("20261103");
    expect(businessDate(at(2026, 11, 4, 6, 0), 6)).toBe("20261104");
  });

  it("rolls back across month and year boundaries", () => {
    expect(businessDate(at(2026, 12, 1, 2), 6)).toBe("20261130");
    expect(businessDate(at(2027, 1, 1, 2), 6)).toBe("20261231");
  });
});

describe("resolveDownloadDir", () => {
  const now = at(2026, 11, 4, 0, 32);

  it("defaults to ~/Downloads when no template is set", () => {
    expect(resolveDownloadDir({ home: HOME, now })).toBe(path.join(HOME, "Downloads"));
    expect(resolveDownloadDir({ template: "  ", home: HOME, now })).toBe(path.join(HOME, "Downloads"));
  });

  it("uses a fixed folder as-is", () => {
    expect(resolveDownloadDir({ template: "C:/매장음악", home: HOME, now })).toBe(path.normalize("C:/매장음악"));
  });

  it("fills {date} with the business date", () => {
    expect(
      resolveDownloadDir({ template: "C:/매장음악/{date}", home: HOME, now, dayStartHour: 6 }),
    ).toBe(path.normalize("C:/매장음악/20261103"));
  });

  it("fills {date} with the calendar date when dayStartHour is 0", () => {
    expect(resolveDownloadDir({ template: "C:/매장음악/{date}", home: HOME, now })).toBe(
      path.normalize("C:/매장음악/20261104"),
    );
  });

  it("expands a leading ~ to the home directory", () => {
    expect(resolveDownloadDir({ template: "~/Music/{date}", home: HOME, now })).toBe(
      path.join(HOME, "Music", "20261104"),
    );
  });

  it("ignores an out-of-range dayStartHour", () => {
    expect(
      resolveDownloadDir({ template: "C:/m/{date}", home: HOME, now, dayStartHour: 30 }),
    ).toBe(path.normalize("C:/m/20261104"));
  });
});
