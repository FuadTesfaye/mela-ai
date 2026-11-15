export function youtubeId(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Use an HTTPS YouTube URL.");
  let id: string | null = null;
  if (url.hostname === "youtu.be") id = url.pathname.split("/")[1];
  else if (
    [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "www.youtube-nocookie.com",
    ].includes(url.hostname)
  ) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (/^\/(embed|shorts|live)\//.test(url.pathname))
      id = url.pathname.split("/")[2];
  }
  if (!id || !/^[-_a-zA-Z0-9]{11}$/.test(id))
    throw new Error("Paste a public YouTube video link.");
  return id;
}
export function youtubeUrl(value: string) {
  return "https://www.youtube.com/watch?v=" + youtubeId(value);
}
