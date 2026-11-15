export async function local(prompt: string) {
  const response = await fetch(
    (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "") +
      "/api/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.2",
        prompt,
        stream: false,
        format: "json",
        options: { num_predict: 700, temperature: 0 },
      }),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) throw new Error("Provider unavailable");
  const data = await response.json();
  return data.response as string;
}
