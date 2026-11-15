export function smsText(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  const points = Array.from(text);
  return points.length <= 160 ? text : points.slice(0, 157).join("") + "...";
}
export async function telegramMessage(chatId: string, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN)
    throw new Error("Telegram is not configured.");
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: Array.from(text).slice(0, 4000).join(""),
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error("Telegram delivery failed.");
  const result = await response.json();
  if (!result.ok) throw new Error("Telegram delivery failed.");
}
export async function smsMessage(to: string, text: string) {
  if (!process.env.SMS_API_URL || !process.env.SMS_API_KEY)
    throw new Error("SMS delivery is not configured.");
  const url = new URL(process.env.SMS_API_URL);
  if (url.protocol !== "https:")
    throw new Error("SMS delivery requires HTTPS.");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.SMS_API_KEY,
    },
    body: JSON.stringify({ to, text: smsText(text) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("SMS delivery failed.");
}
export async function deliver(
  channel: string,
  destination: string,
  text: string,
) {
  return channel === "telegram"
    ? telegramMessage(destination, text)
    : smsMessage(destination, text);
}

/** Reserve channel space for at least one source rather than truncating citations away. */
export function channelAnswer(
  answer: import("../types").Answer,
  channel: "telegram" | "sms",
  base: string,
) {
  const citations = answer.citations.map((c) => ({
    ...c,
    url: new URL(c.url, base).href,
  }));
  if (channel === "sms") {
    const citation = citations[0];
    if (!citation) return smsText(answer.answer);
    const reference =
      Array.from(citation.url).length <= 120
        ? citation.url
        : "Source: " + citation.id.slice(0, 80);
    const budget = 159 - Array.from(reference).length;
    return smsText(
      Array.from(answer.answer.replace(/\s+/g, " "))
        .slice(0, Math.max(0, budget))
        .join("") +
        " " +
        reference,
    );
  }
  const lines: string[] = [];
  for (const citation of citations) {
    const line = citation.title + ": " + citation.url;
    if (Array.from([...lines, line].join("\n")).length <= 3000)
      lines.push(line);
  }
  const sources = lines.join("\n");
  const budget = 4000 - Array.from(sources).length - (sources ? 2 : 0);
  return (
    Array.from(answer.answer).slice(0, budget).join("") +
    (sources ? "\n\n" + sources : "")
  );
}
