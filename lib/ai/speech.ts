/** Text-to-speech for MELA's voice, best free option first:
 *  1. Groq Orpheus (natural, fast, English) — needs GROQ_API_KEY and the model
 *     terms accepted once in the Groq console.
 *  2. Gemini TTS (natural, many languages) — free tier allows ~10 requests/day.
 *  3. eSpeak NG (free, offline, robotic) — if installed on the server
 *     (`dnf install espeak-ng` / `apt install espeak-ng`); not on Vercel.
 * Results are cached in memory so repeated phrases cost nothing. */
import { spawn } from "node:child_process";
import { addisConfigured, addisSpeak, ADDIS_VOICES } from "./providers/addis";

export type Speech = {
  audio: Buffer;
  engine: "addis" | "groq" | "gemini" | "espeak";
};
const cache = new Map<string, Speech>();
const failedUntil: Record<string, number> = {};
const skip = (engine: string) => (failedUntil[engine] || 0) > Date.now();
const pause = (engine: string, minutes: number) =>
  (failedUntil[engine] = Date.now() + minutes * 60_000);

function wav(pcm: Buffer, rate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function groq(text: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key || skip("groq")) return;
  const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "canopylabs/orpheus-v1-english",
      input: text.slice(0, 1000),
      voice: process.env.GROQ_VOICE || "diana",
      response_format: "wav",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Terms not accepted / quota: stop trying for a while.
    pause("groq", response.status === 400 || response.status === 403 ? 3 : 1);
    return;
  }
  return Buffer.from(await response.arrayBuffer());
}

async function gemini(text: string, language: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || skip("gemini")) return;
  for (const model of [
    "gemini-3.8-flash-lite-tts",
    "gemini-3.1-flash-tts-preview",
    "gemini-3.8-flash-tts",
  ]) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text.slice(0, 1000) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
            },
          },
        }),
        signal: AbortSignal.timeout(20000),
      },
    ).catch(() => undefined);
    if (!response?.ok) continue;
    const data = await response.json();
    const part = data.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: unknown }) => p.inlineData,
    )?.inlineData as { mimeType: string; data: string } | undefined;
    if (!part) continue;
    const bytes = Buffer.from(part.data, "base64");
    return /wav/i.test(part.mimeType)
      ? bytes
      : wav(bytes, Number(/rate=(\d+)/.exec(part.mimeType)?.[1] || 24000));
  }
  pause("gemini", 30); // daily free quota is small
}

function espeak(text: string, language: string) {
  if (skip("espeak")) return Promise.resolve(undefined);
  return new Promise<Buffer | undefined>((resolve) => {
    const voice = language === "am" ? "am" : language === "om" ? "om" : "en-us";
    let child;
    try {
      // Arguments, not a shell: the text cannot inject commands.
      child = spawn("espeak-ng", [
        "-v",
        voice,
        "-s",
        "155",
        "--stdout",
        text.slice(0, 1000),
      ]);
    } catch {
      pause("espeak", 60);
      return resolve(undefined);
    }
    const chunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.on("error", () => {
      pause("espeak", 60);
      resolve(undefined);
    });
    child.on("close", (code) =>
      resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : undefined),
    );
    setTimeout(() => child.kill(), 10000);
  });
}

export async function synthesize(
  text: string,
  language = "en",
): Promise<Speech | undefined> {
  const key = language + ":" + text;
  const hit = cache.get(key);
  if (hit) return hit;
  let result: Speech | undefined;
  // Ethiopian languages: Addis AI's native voices first.
  if (ADDIS_VOICES[language] && addisConfigured() && !skip("addis")) {
    const audio = await addisSpeak(text, language).catch(() => {
      pause("addis", 2);
      return undefined;
    });
    if (audio) {
      result = { audio, engine: "addis" };
      cache.set(key, result);
      return result;
    }
  }
  const natural =
    language === "en" ? await groq(text).catch(() => undefined) : undefined;
  if (natural) result = { audio: natural, engine: "groq" };
  else {
    const g = await gemini(text, language).catch(() => undefined);
    if (g) result = { audio: g, engine: "gemini" };
    else {
      const e = await espeak(text, language);
      if (e) result = { audio: e, engine: "espeak" };
    }
  }
  if (result) {
    cache.set(key, result);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return result;
}
