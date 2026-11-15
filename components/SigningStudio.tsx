"use client";
import { useEffect, useRef, useState } from "react";
import { youtubeId } from "@/lib/media/youtube";
import { youtubeAPI, type YouTubePlayer } from "@/module/media/youtube-player";
type Track = {
  id: string;
  videoId: string;
  status: string;
  interpreter: string;
  sourceDuration: number;
  duration: number;
  offsetSeconds: number;
  hasMedia: boolean;
  notes?: string;
};
const checks = {
  fluentEthSL: "I am fluent in Ethiopian Sign Language",
  accurateMeaning: "Meaning accurately represents the source",
  visibleHandsAndFace: "Hands, face and signing space remain visible",
  synchronized: "Timing matches the source throughout",
  completeCoverage: "The complete lesson has been interpreted",
};
export default function SigningStudio() {
  const [lesson, setLesson] = useState("programming-for-beginners"),
    [url, setUrl] = useState("https://youtu.be/bJzb-RuUcMU"),
    [tracks, setTracks] = useState<Track[]>([]),
    [password, setPassword] = useState(""),
    [authorized, setAuthorized] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [file, setFile] = useState<Blob>(),
    [preview, setPreview] = useState(""),
    [interpreter, setInterpreter] = useState(""),
    [consent, setConsent] = useState(false),
    [sourceDuration, setSourceDuration] = useState(0),
    [duration, setDuration] = useState(0),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<Track>(),
    [reviewer, setReviewer] = useState(""),
    [notes, setNotes] = useState(""),
    [checked, setChecked] = useState<Record<string, boolean>>({});
  const camera = useRef<HTMLVideoElement>(null),
    host = useRef<HTMLDivElement>(null),
    player = useRef<YouTubePlayer>(null),
    stream = useRef<MediaStream>(null),
    recorder = useRef<MediaRecorder>(null),
    chunks = useRef<Blob[]>([]),
    size = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout>>(null),
    started = useRef(false);
  async function request(path: string, init?: RequestInit) {
    const r = await fetch(path, init);
    const data = await r.json();
    if (r.status === 401) setAuthorized(false);
    if (!r.ok) throw Error(data.error || "Request failed");
    return data;
  }
  async function refresh() {
    try {
      const data = await request(`/api/v1/lessons/${lesson}/signing`);
      setTracks(data.tracks);
      setAuthorized(true);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, [lesson]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const object = URL.createObjectURL(file);
    setPreview(object);
    return () => URL.revokeObjectURL(object);
  }, [file]);
  function stop() {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current && recorder.current.state !== "inactive")
      recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    player.current?.pauseVideo();
    started.current = false;
    setRecording(false);
  }
  useEffect(
    () => () => {
      recorder.current?.state !== "inactive" && recorder.current?.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      player.current?.destroy();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function loadSource() {
    try {
      const id = youtubeId(url);
      player.current?.destroy();
      player.current = null;
      host.current!.replaceChildren();
      const frame = document.createElement("iframe");
      frame.title = "Source lesson for signing";
      frame.src = `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
      frame.allow = "autoplay; fullscreen";
      frame.style.cssText = "width:100%;aspect-ratio:16/9;border:0";
      host.current!.append(frame);
      const api = await youtubeAPI();
      player.current = new api.Player(frame, {
        events: {
          onReady: () => {
            setSourceDuration(player.current?.getDuration() || 0);
          },
          onStateChange: ({ data }) => {
            const rec = recorder.current;
            if (!rec) return;
            if (data === 1) {
              if (rec.state === "inactive" && !started.current) {
                started.current = true;
                setOffset(player.current?.getCurrentTime() || 0);
                rec.start(1000);
              } else if (rec.state === "paused") rec.resume();
            } else if (data === 0) stop();
            else if (rec.state === "recording") rec.pause();
          },
        },
      });
      setNotice(
        "Source loaded. Record from the beginning; playback pauses also pause recording. Review synchronization before approval.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function record() {
    try {
      if (!player.current) throw Error("Load the source video first.");
      if (!window.MediaRecorder)
        throw Error(
          "Camera recording is unavailable. Upload an MP4 or WebM instead.",
        );
      player.current.pauseVideo();
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24 },
        },
        audio: false,
      });
      stream.current = media;
      camera.current!.srcObject = media;
      await camera.current!.play();
      const mime = ["video/webm;codecs=vp8", "video/webm", "video/mp4"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      );
      if (!mime) throw Error("Use a browser supporting MP4 or WebM recording.");
      const rec = new MediaRecorder(media, {
        mimeType: mime,
        videoBitsPerSecond: 2_000_000,
      });
      recorder.current = rec;
      chunks.current = [];
      size.current = 0;
      started.current = false;
      setFile(undefined);
      rec.ondataavailable = (e) => {
        size.current += e.data.size;
        if (size.current > 128 * 1024 * 1024) {
          chunks.current = [];
          stop();
          setNotice(
            "Recording exceeded 128 MiB. Upload a smaller complete recording.",
          );
        } else if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        if (chunks.current.length)
          setFile(new Blob(chunks.current, { type: mime.split(";")[0] }));
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      player.current.seekTo(0, true);
      setSourceDuration(player.current.getDuration());
      setRecording(true);
      player.current.playVideo();
      timer.current = setTimeout(stop, 20 * 60 * 1000);
      setNotice(
        "Recording starts when the source plays. Keep your hands and face visible.",
      );
    } catch (e) {
      stop();
      setNotice((e as Error).message);
    }
  }
  async function upload() {
    setBusy(true);
    try {
      if (!file || !consent)
        throw Error("Provide a recording and publication permission.");
      if (file.size > 128 * 1024 * 1024)
        throw Error("Maximum file size is 128 MiB.");
      const draft = await request(`/api/v1/lessons/${lesson}/signing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: url,
          interpreter,
          publicationConsent: consent,
          sourceDuration,
          duration,
          offsetSeconds: offset,
        }),
      });
      const r = await fetch(`/api/v1/signing/${draft.id}/media`, {
        method: "PUT",
        headers: { "Content-Type": file.type.split(";")[0] },
        body: file,
      });
      if (!r.ok) throw Error((await r.json()).error);
      await request(`/api/v1/signing/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      setNotice(
        "Private recording submitted. A separate fluent signer must review it before learners see it.",
      );
      await refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(action: "approve" | "reject" | "archive") {
    if (!selected) return;
    setBusy(true);
    try {
      await request(`/api/v1/signing/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewer,
          notes,
          offsetSeconds: offset,
          checks: checked,
        }),
      });
      setSelected(undefined);
      setNotice(
        action === "approve"
          ? "Approved interpretation is now available in the lesson signing square."
          : "Review saved.",
      );
      await refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const inputStyle = {
    display: "block",
    width: "100%",
    padding: 10,
    margin: "6px 0 16px",
    border: "1px solid #b7cbd7",
    borderRadius: 6,
  };
  return (
    <section>
      <p role="status">{notice}</p>
      {!authorized ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await request("/api/v1/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
              setPassword("");
              await refresh();
            } catch (e) {
              setNotice((e as Error).message);
            }
          }}
        >
          <label>
            Tutor password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </label>
          <button>Sign in</button>
        </form>
      ) : (
        <>
          <label>
            Lesson
            <select
              style={inputStyle}
              disabled={recording}
              value={lesson}
              onChange={(e) => {
                setLesson(e.target.value);
                setSelected(undefined);
              }}
            >
              <option value="programming-for-beginners">
                Programming for Beginners
              </option>
              <option value="offline-first-localized-ai">
                Offline-First & Localized AI
              </option>
              <option value="va-future">Virtual assistance</option>
            </select>
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(min(100%,320px),1fr))",
              gap: 24,
            }}
          >
            <div>
              <h2>1. Record an interpretation</h2>
              <p>
                A fluent EthSL signer performs the complete lesson. Camera
                recording stays on this device until you submit it. Maximum 128
                MiB.
              </p>
              <label>
                YouTube source URL
                <input
                  style={inputStyle}
                  value={url}
                  disabled={recording}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              <button onClick={loadSource} disabled={recording}>
                Load source video
              </button>
              <div ref={host} />
              <video
                ref={camera}
                muted
                playsInline
                style={{ width: "100%", maxHeight: 300, background: "#15394d" }}
              />
              <button onClick={record} disabled={recording || busy}>
                Record camera with source
              </button>{" "}
              <button onClick={stop} disabled={!recording}>
                Stop recording
              </button>
              <label style={{ display: "block", marginTop: 20 }}>
                Or upload a complete MP4 / WebM
                <input
                  style={inputStyle}
                  type="file"
                  accept="video/mp4,video/webm"
                  disabled={recording}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      setDuration(0);
                    }
                  }}
                />
              </label>
              {preview && (
                <video
                  controls
                  src={preview}
                  style={{ width: "100%" }}
                  onLoadedMetadata={(e) => {
                    const n = e.currentTarget.duration;
                    if (Number.isFinite(n)) setDuration(n);
                  }}
                />
              )}
              <label>
                Interpreter’s name
                <input
                  style={inputStyle}
                  value={interpreter}
                  onChange={(e) => setInterpreter(e.target.value)}
                />
              </label>
              <label>
                Source duration (seconds)
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  max="14400"
                  value={sourceDuration}
                  onChange={(e) => setSourceDuration(Number(e.target.value))}
                />
              </label>
              <label>
                Recording duration (seconds)
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  max="14400"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </label>
              <p>
                Verify durations against playback. Browser metadata can be
                unavailable for camera WebM files.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                The interpreter permits publication of this recording.
              </label>
              <p>
                <button
                  disabled={!file || !consent || busy || recording}
                  onClick={upload}
                >
                  Upload privately and submit for review
                </button>
              </p>
            </div>
            <div>
              <h2>2. Review and publish</h2>
              <p>
                Only an approved interpretation for the exact video appears to
                learners. These declarations are recorded; software cannot
                verify fluency or identity.
              </p>
              <button onClick={refresh}>Refresh recordings</button>
              <ul>
                {tracks.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setSelected(t);
                        setOffset(t.offsetSeconds);
                        setChecked({});
                        setNotes(t.notes || "");
                      }}
                    >
                      {t.interpreter} · {t.status}
                    </button>
                  </li>
                ))}
              </ul>
              {selected && (
                <article>
                  <h3>
                    {selected.interpreter} · {selected.status}
                  </h3>
                  <a
                    href={`https://www.youtube.com/watch?v=${selected.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open matching source for comparison
                  </a>
                  {selected.hasMedia && (
                    <video
                      controls
                      src={`/api/v1/signing/${selected.id}/media`}
                      style={{ width: "100%" }}
                    />
                  )}
                  <label>
                    Separate fluent reviewer’s name
                    <input
                      style={inputStyle}
                      value={reviewer}
                      onChange={(e) => setReviewer(e.target.value)}
                    />
                  </label>
                  <label>
                    Source offset (seconds; source time minus recording time)
                    <input
                      style={inputStyle}
                      type="number"
                      min="-30"
                      max="30"
                      value={offset}
                      onChange={(e) => setOffset(Number(e.target.value))}
                    />
                  </label>
                  {Object.entries(checks).map(([key, label]) => (
                    <label
                      key={key}
                      style={{ display: "block", margin: "12px 0" }}
                    >
                      <input
                        type="checkbox"
                        checked={!!checked[key]}
                        onChange={(e) =>
                          setChecked({ ...checked, [key]: e.target.checked })
                        }
                      />{" "}
                      {label}
                    </label>
                  ))}
                  <label>
                    Review notes
                    <textarea
                      style={inputStyle}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={
                      busy ||
                      selected.status !== "awaiting-review" ||
                      !Object.keys(checks).every((k) => checked[k])
                    }
                    onClick={() => review("approve")}
                  >
                    Approve for learners
                  </button>{" "}
                  <button
                    disabled={busy || selected.status !== "awaiting-review"}
                    onClick={() => review("reject")}
                  >
                    Request corrections
                  </button>{" "}
                  <button
                    disabled={busy || selected.status !== "approved"}
                    onClick={() => review("archive")}
                  >
                    Unpublish
                  </button>
                </article>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
