// Derive a thumbnail + embeddable URL from a course's videoUrl.
// Supports YouTube (watch / youtu.be / embed / shorts) and Vimeo; anything else
// falls back to using the raw URL as the embed src with no thumbnail.

export function youtubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

// Thumbnail image URL, or null if we can't derive one (caller shows a placeholder).
export function videoThumbnail(url: string): string | null {
  const yt = youtubeId(url);
  if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
  return null;
}

// True when the URL points at a raw video file we can play in a custom <video>.
const FILE_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i;
export function isVideoFile(url: string): boolean {
  return FILE_RE.test(url);
}

// URL suitable for an <iframe src> (YouTube/Vimeo fallback).
export function videoEmbedUrl(url: string): string {
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  const vm = vimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm}`;
  return url;
}
