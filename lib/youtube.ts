import { Innertube, YTNodes } from "youtubei.js";

export type YoutubeMatch = {
  videoId: string;
  url: string;
  title: string;
  thumbnailUrl: string;
};

let clientPromise: Promise<Innertube> | null = null;
function getClient(): Promise<Innertube> {
  if (!clientPromise) {
    clientPromise = Innertube.create();
  }
  return clientPromise;
}

export async function searchTopMatch(
  query: string,
): Promise<YoutubeMatch | null> {
  const yt = await getClient();
  const search = await yt.search(query, { type: "video" });
  const video = search.results.firstOfType(YTNodes.Video);
  if (!video) return null;

  const thumb = video.best_thumbnail ?? video.thumbnails[0];
  return {
    videoId: video.video_id,
    url: `https://www.youtube.com/watch?v=${video.video_id}`,
    title: String(video.title),
    thumbnailUrl: thumb?.url ?? "",
  };
}
