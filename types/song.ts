export type Song = {
  title: string;
  artist: string;
  youtubeUrl: string;
  thumbnailUrl: string;
};

export type SongSeed = Pick<Song, "title" | "artist">;

export type SongStatus =
  | "pending"
  | "searching"
  | "downloading"
  | "converting"
  | "done"
  | "failed";

export type SongJobItem = {
  title: string;
  artist: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  selected: boolean;
  status: SongStatus;
  failureReason?: string;
  downloadName?: string;
  filePath?: string;
};

export type JobMode = "url" | "playlist";

export type Job = {
  id: string;
  mode: JobMode;
  items: SongJobItem[];
  createdAt: number;
};

export type JobStatus = {
  id: string;
  mode: JobMode;
  items: SongJobItem[];
  terminated: boolean;
};

export function isTerminal(status: SongStatus): boolean {
  return status === "done" || status === "failed";
}
