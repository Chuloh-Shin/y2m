import path from "node:path";

/**
 * The date a moment belongs to, as YYYYMMDD in local time. Hours before
 * `dayStartHour` count as the previous day, so a shop closing after
 * midnight keeps filing into the same day's folder.
 */
export function businessDate(now: Date, dayStartHour: number): string {
  const d = new Date(now);
  if (d.getHours() < dayStartHour) d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

type Options = {
  /** DOWNLOAD_DIR, e.g. "C:/매장음악/{date}". Unset → ~/Downloads. */
  template?: string;
  home: string;
  now: Date;
  /** DOWNLOAD_DAY_START_HOUR (0–23). Hours before it belong to the previous day. */
  dayStartHour?: number;
};

/** Folder converted mp3s are copied into. */
export function resolveDownloadDir({ template, home, now, dayStartHour = 0 }: Options): string {
  const t = template?.trim();
  if (!t) return path.join(home, "Downloads");

  const hour = Number.isInteger(dayStartHour) && dayStartHour >= 0 && dayStartHour <= 23 ? dayStartHour : 0;
  const filled = t.replace(/\{date\}/g, businessDate(now, hour));
  const expanded = filled === "~" || /^~[\\/]/.test(filled) ? path.join(home, filled.slice(1)) : filled;
  return path.normalize(expanded);
}
