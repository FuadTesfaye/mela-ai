import { z } from "zod";
import { api, jsonBody } from "@/lib/security/http";
import { equal, bearer, HttpError } from "@/lib/security/auth";
import { handleCommand } from "@/lib/channels/commands";
import { smsText } from "@/lib/channels/transports";
export async function POST(request: Request) {
  const response = await api(
    request,
    async () => {
      if (
        !process.env.SMS_INBOUND_SECRET ||
        process.env.SMS_INBOUND_SECRET.length < 24
      )
        throw new HttpError(503, "Text gateway is not configured.");
      if (!equal(bearer(request), process.env.SMS_INBOUND_SECRET))
        throw new HttpError(401, "Gateway authentication required.");
      const input = z
        .object({
          from: z.string().regex(/^\+[1-9]\d{7,14}$/),
          text: z.string().trim().min(1).max(2000),
        })
        .parse(await jsonBody(request, 10000));
      return new Response(
        smsText(await handleCommand("sms", input.from, input.text)),
        { headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    },
    60,
  );
  if (response.headers.get("content-type")?.includes("application/json")) {
    const data = await response.json();
    return new Response(smsText(data.error || "MELA is unavailable."), {
      status: response.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  return response;
}
