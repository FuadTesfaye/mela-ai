/** Addis AI (api.addisassistant.com): Ethiopian-language chat, translation,
 * natural voices and speech-to-text. Used first for Amharic / Afaan Oromo /
 * Tigrinya; other providers remain fallbacks. Paid per use (ETB credits). */
const BASE = "https://api.addisassistant.com";
const key = () => process.env.ADDIS_API_KEY || "";
export const addisConfigured = () => !!key();

/** Default natural voice per language (from GET /api/v1/voice/voices). */
export const ADDIS_VOICES: Record<string, string> = {
  am: "am-hamen",
  om: "om-bikila",
  ti: "ti-berhane",
};

async function post(path: string, body: unknown, timeout = 20000) {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "x-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok)
    throw new Error(`Addis AI ${path} failed (${response.status}).`);
  return response.json();
}

/** Amharic / Afaan Oromo text generation. */
export async function addisChat(
  prompt: string,
  language: "am" | "om",
  system?: string,
) {
  const data = await post("/api/v1/chat_generate", {
    prompt,
    target_language: language,
    ...(system ? { system } : {}),
    generation_config: { temperature: 0.4, maxOutputTokens: 700 },
  });
  const text = String(
    data?.data?.response_text ?? data?.response_text ?? "",
  ).trim();
  if (!text) throw new Error("Addis AI returned no text.");
  return text;
}

export async function addisTranslate(text: string, from: string, to: string) {
  const data = await post("/api/v1/translate", {
    text: text.slice(0, 5000),
    source_language: from,
    target_language: to,
  });
  const out = String(data?.data?.translation || "").trim();
  if (!out) throw new Error("Addis AI returned no translation.");
  return out;
}

/** Natural voice; returns WAV bytes. */
export async function addisSpeak(text: string, language: string) {
  const voice = ADDIS_VOICES[language];
  if (!voice) throw new Error("No Addis voice for this language.");
  const data = await post(
    "/api/v1/voice/generations",
    {
      text: text.slice(0, 1000),
      voice_id: voice,
      language,
      output_format: "wav_44100",
      client_request_id: "mela-" + crypto.randomUUID(),
    },
    30000,
  );
  const audio = String(data?.data?.audio || "");
  if (audio.startsWith("data:"))
    return Buffer.from(audio.split(",")[1], "base64");
  const url = data?.data?.playback?.url || data?.data?.audio_url;
  if (!url) throw new Error("Addis AI returned no audio.");
  const file = await fetch(url, { headers: { "x-api-key": key() } });
  if (!file.ok) throw new Error("Addis AI audio download failed.");
  return Buffer.from(await file.arrayBuffer());
}

/** Speech-to-text (Scribe): am, om, ti, en and more. */
export async function addisTranscribe(
  audio: Buffer,
  mimeType: string,
  language: string,
) {
  const form = new FormData();
  const extension = mimeType.split("/")[1]?.replace("mpeg", "mp3") || "webm";
  form.append(
    "audio",
    new Blob([new Uint8Array(audio)], { type: mimeType }),
    "speech." + extension,
  );
  const url = `${BASE}/api/v1/scribe/transcribe?language=${encodeURIComponent(language)}&request_id=mela-${crypto.randomUUID()}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-api-key": key() },
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(`Addis AI transcription failed (${response.status}).`);
  const data = await response.json();
  return String(data?.data?.text || "")
    .trim()
    .slice(0, 2000);
}
