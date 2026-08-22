export const maxInspiratorEmbeds = 6;

export type InspiratorEmbedProvider = "spotify" | "youtube";

export type NormalizedInspiratorEmbed = {
  embedUrl: string;
  height: "compact" | "tall" | "video";
  provider: InspiratorEmbedProvider;
  url: string;
};

const spotifyKinds = new Set(["album", "artist", "episode", "playlist", "show", "track"]);

function cleanUrl(value: string) {
  return value.trim();
}

function isValidYoutubeId(value: string) {
  return /^[a-zA-Z0-9_-]{6,}$/.test(value);
}

export function normalizeInspiratorEmbedUrl(value: string): NormalizedInspiratorEmbed | null {
  const trimmedValue = cleanUrl(value);
  if (!trimmedValue) return null;

  let url: URL;
  try {
    url = new URL(trimmedValue);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    const videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!isValidYoutubeId(videoId)) return null;
    return {
      embedUrl: "https://www.youtube.com/embed/" + encodeURIComponent(videoId),
      height: "video",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId),
    };
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const pathParts = url.pathname.split("/").filter(Boolean);
    const videoId =
      url.pathname === "/watch"
        ? url.searchParams.get("v") ?? ""
        : pathParts[0] === "shorts" || pathParts[0] === "embed"
          ? pathParts[1] ?? ""
          : "";

    if (!isValidYoutubeId(videoId)) return null;
    return {
      embedUrl: "https://www.youtube.com/embed/" + encodeURIComponent(videoId),
      height: "video",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId),
    };
  }

  if (host === "open.spotify.com") {
    const pathParts = url.pathname.split("/").filter(Boolean);
    const offset = pathParts[0] === "embed" ? 1 : 0;
    const kind = pathParts[offset] ?? "";
    const id = pathParts[offset + 1] ?? "";

    if (!spotifyKinds.has(kind) || !/^[a-zA-Z0-9]+$/.test(id)) return null;

    return {
      embedUrl: "https://open.spotify.com/embed/" + kind + "/" + encodeURIComponent(id),
      height: kind === "track" || kind === "episode" ? "compact" : "tall",
      provider: "spotify",
      url: "https://open.spotify.com/" + kind + "/" + encodeURIComponent(id),
    };
  }

  return null;
}

export function inspiratorEmbedErrorMessage() {
  return "Indsæt et gyldigt Spotify- eller YouTube-link.";
}
