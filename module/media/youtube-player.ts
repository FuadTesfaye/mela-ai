export interface YouTubePlayer {
  getCurrentTime(): number;
  getDuration(): number;
  pauseVideo(): void;
  getPlayerState(): number;
  getPlaybackRate(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}
interface YouTubeAPI {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
}
let ready: Promise<YouTubeAPI> | undefined;
export function youtubeAPI() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    const win = window as unknown as {
      YT?: YouTubeAPI;
      onYouTubeIframeAPIReady?: () => void;
    };
    if (win.YT?.Player) {
      resolve(win.YT);
      return;
    }
    const previous = win.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => {
      ready = undefined;
      reject(
        new Error(
          "YouTube controls are unavailable. The embedded player may still be used.",
        ),
      );
    }, 15000);
    win.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timeout);
      if (win.YT) resolve(win.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      clearTimeout(timeout);
      ready = undefined;
      reject(new Error("Could not load YouTube controls."));
    };
    document.head.append(script);
  });
  return ready;
}
