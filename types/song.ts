export type Song = {
  title: string;
  artist: string;
  youtubeUrl: string;
  thumbnailUrl: string;
};

export type SongSeed = Pick<Song, "title" | "artist">;
