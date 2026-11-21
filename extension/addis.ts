/** Addis AI from the extension service worker: Ethiopian-language chat,
 * translation, natural voices and speech-to-text. Key from the settings page. */
const BASE = "https://api.addisassistant.com";
export const ADDIS_LANGUAGES = ["am", "om", "ti"];
const VOICES: Record<string, string> = {
  am: "am-hamen",
  om: "om-bikila",
  ti: "ti-berhane",
};

async function post(key: string, path: string, body: unknown, timeout = 20000) {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (response.status === 401 || response.status === 403)
    throw new Error(
      "Addis AI rejected the API key. Check it in the MELA settings.",
    );
  if (!response.ok) throw new Error("Addis AI is temporarily unavailable.");
  return response.json();
}

/** Amharic / Afaan Oromo answers. */
export async function addisChat(
  key: string,
  language: "am" | "om",
  system: string,
  prompt: string,
) {
  const data = await post(key, "/api/v1/chat_generate", {
    prompt,
    system,
    target_language: language,
    generation_config: { temperature: 0.4, maxOutputTokens: 700 },
  });
  const text = String(
    data?.data?.response_text ?? data?.response_text ?? "",
  ).trim();
  if (!text) throw new Error("Addis AI returned no answer.");
  return text;
}

export async function addisTranslate(
  key: string,
  text: string,
  from: string,
  to: string,
) {
  const data = await post(key, "/api/v1/translate", {
    text: text.slice(0, 5000),
    source_language: from,
    target_language: to,
  });
  const out = String(data?.data?.translation || "").trim();
  if (!out) throw new Error("Addis AI returned no translation.");
  return out;
}

/** Natural Ethiopian voice; returns base64 WAV. */
export async function addisSpeak(key: string, text: string, language: string) {
  const voice = VOICES[language];
  if (!voice) throw new Error("No Addis voice for this language.");
  const data = await post(
    key,
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
  if (!audio.startsWith("data:"))
    throw new Error("Addis AI returned no audio.");
  return audio.split(",")[1];
}

export async function addisTranscribe(
  key: string,
  audio: string,
  mimeType: string,
  language: string,
) {
  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  const form = new FormData();
  // Chrome records WebM, Firefox records Ogg.
  const ext = mimeType.split("/")[1]?.replace("mpeg", "mp3") || "webm";
  form.append("audio", new Blob([bytes], { type: mimeType }), "speech." + ext);
  const response = await fetch(
    `${BASE}/api/v1/scribe/transcribe?language=${encodeURIComponent(language)}&request_id=mela-${crypto.randomUUID()}`,
    {
      method: "POST",
      headers: { "x-api-key": key },
      body: form,
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) throw new Error("Addis AI transcription failed.");
  const data = await response.json();
  return String(data?.data?.text || "")
    .trim()
    .slice(0, 2000);
}
