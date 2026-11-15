import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
export function webhookUrl(value: string) {
  const url = new URL(value);
  const allowed = (process.env.WEBHOOK_ALLOWED_HOSTS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname) ||
    !allowed.includes(url.hostname)
  )
    throw new Error(
      "Use an HTTPS webhook host explicitly configured in WEBHOOK_ALLOWED_HOSTS.",
    );
  return url;
}
export async function publicWebhookUrl(value: string) {
  const url = webhookUrl(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => {
      if (address.includes(":")) return !/^[23][0-9a-f]{3}:/i.test(address);
      const parts = address.split(".").map(Number);
      return (
        parts[0] === 0 ||
        parts[0] === 10 ||
        parts[0] === 127 ||
        parts[0] >= 224 ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
      );
    })
  )
    throw new Error("Webhook must resolve to a public address.");
  return url;
}
