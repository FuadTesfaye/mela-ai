/** Groq (OpenAI-compatible) fallback: fast JSON answers and Whisper transcription. */
const BASE = "https://api.groq.com/openai/v1";

export const groqConfigured = () => !!process.env.GROQ_API_KEY;

/** JSON-mode chat completion; the prompt must describe the JSON shape. */
export async function groqJson(
  system: string,
  prompt: string,
  options: { maxTokens?: number; timeout?: number } = {},
) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Groq is not configured.");
  let last: Error = new Error("Groq is temporarily unavailable.");
  for (const model of ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]) {
    try {
      const response = await fetch(BASE + "/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system + " Reply with JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_completion_tokens: options.maxTokens || 2048,
          reasoning_effort: "low",
        }),
        signal: AbortSignal.timeout(options.timeout || 20000),
      });
      if (!response.ok) {
        last = new Error(
          response.status === 429
            ? "Groq quota is unavailable. Please try again later."
            : "Groq is temporarily unavailable.",
        );
        continue;
      }
      const data = await response.json();
      const text = String(data.choices?.[0]?.message?.content || "");
      if (text) return text;
    } catch {
      /* try the next model */
    }
  }
  throw last;
}

export async function groqTranscribe(
  audio: Buffer,
  mimeType: string,
  language: string,
) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Groq is not configured.");
  const form = new FormData();
  const extension = mimeType.split("/")[1]?.replace("mpeg", "mp3") || "webm";
  form.append(
    "file",
    new Blob([new Uint8Array(audio)], { type: mimeType }),
    "speech." + extension,
  );
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (language === "en" || language === "am") form.append("language", language);
  const response = await fetch(BASE + "/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key },
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Groq transcription failed.");
  const data = await response.json();
  return String(data.text || "")
    .trim()
    .slice(0, 2000);
}
