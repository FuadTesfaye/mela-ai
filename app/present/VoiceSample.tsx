"use client";
import { useState } from "react";
/** Plays MELA's natural voice for a sample sentence (server /api/v1/tts). */
export default function VoiceSample({
  text,
  language,
  label,
}: {
  text: string;
  language: "en" | "am" | "om" | "ti";
  label: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">(
    "idle",
  );
  const play = async () => {
    setState("loading");
    try {
      const response = await fetch("/api/v1/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      if (!response.ok) throw new Error();
      const audio = new Audio(URL.createObjectURL(await response.blob()));
      audio.onended = () => setState("idle");
      setState("playing");
      await audio.play();
    } catch {
      setState("error");
    }
  };
  return (
    <button
      type="button"
      className="voice"
      onClick={play}
      disabled={state === "loading"}
    >
      {state === "loading"
        ? "⏳ Generating voice…"
        : state === "playing"
          ? "🔊 Speaking…"
          : state === "error"
            ? "Voice unavailable, try again"
            : `▶ ${label}`}
      <span lang={language}>{text}</span>
    </button>
  );
}
