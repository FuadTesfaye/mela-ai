/** Groq (OpenAI-compatible) calls from the extension service worker:
 * Whisper transcription (~1 s), fast chat answers and the Orpheus English voice.
 * The key is entered by the user in the extension settings and stays in this browser. */
const BASE = "https://api.groq.com/openai/v1";
const CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const VOICES = ["diana", "hannah", "autumn", "troy"];

async function failure(response: Response) {
  const detail = await response.text().catch(() => "");
  if (response.status === 401 || response.status === 403)
    return new Error(
      "Groq rejected the API key. Check it in the MELA settings.",
    );
  if (response.status === 429)
    return new Error("Groq rate limit reached. Please try again shortly.");
  if (/terms/i.test(detail))
    return new Error(
      "Accept the Orpheus voice terms in the Groq console to enable the Groq voice.",
    );
  return new Error("Groq is temporarily unavailable.");
}

export async function groqChat(
  key: string,
  system: string,
  user: string,
): Promise<string> {
  let last: Error = new Error("Groq is temporarily unavailable.");
  for (const model of CHAT_MODELS) {
    const response = await fetch(BASE + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_completion_tokens: 900,
        reasoning_effort: "low",
      }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => undefined);
    if (!response) continue;
    if (!response.ok) {
      last = await failure(response);
      if (/rejected/.test(last.message)) throw last;
      continue;
    }
    const data = await response.json();
    const text = String(data.choices?.[0]?.message?.content || "").trim();
    if (text) return text;
  }
  throw last;
}

export async function groqTranscribe(
  key: string,
  audio: string,
  mimeType: string,
  language: string,
): Promise<string> {
  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  const extension = mimeType.includes("mp4")
    ? "mp4"
    : mimeType.includes("ogg")
      ? "ogg"
      : mimeType.includes("wav")
        ? "wav"
        : "webm";
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: mimeType }),
    "speech." + extension,
  );
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (["en", "am"].includes(language)) form.append("language", language);
  const response = await fetch(BASE + "/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key },
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw await failure(response);
  const data = await response.json();
  return String(data.text || "")
    .trim()
    .slice(0, 2000);
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/** English natural voice (Orpheus). Returns base64 WAV. */
export async function groqSpeak(key: string, text: string): Promise<string> {
  let last: Error = new Error("Groq voice is unavailable.");
  for (const voice of VOICES) {
    const response = await fetch(BASE + "/audio/speech", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "canopylabs/orpheus-v1-english",
        input: text.slice(0, 1200),
        voice,
        response_format: "wav",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok)
      return toBase64(new Uint8Array(await response.arrayBuffer()));
    last = await failure(response);
    // Only an unknown voice name is worth retrying with another voice.
    if (/rejected|terms|rate limit/.test(last.message)) throw last;
  }
  throw last;
}
