import { z } from "zod";
import { db } from "@/lib/database/db";
import { equal, HttpError } from "@/lib/security/auth";
import { api, jsonBody } from "@/lib/security/http";
const schema = z.object({
  update_id: z.number().int().nonnegative().safe(),
  message: z
    .object({
      chat: z.object({ id: z.number().int().safe(), type: z.string() }),
      text: z.string().max(2000).optional(),
    })
    .optional(),
});
export const POST = (request: Request) =>
  api(request, async () => {
    const key = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!key || key.length < 24)
      throw new HttpError(503, "Telegram webhook is not configured.");
    if (
      !equal(request.headers.get("x-telegram-bot-api-secret-token") || "", key)
    )
      throw new HttpError(401, "Webhook authentication required.");
    const update = schema.parse(await jsonBody(request, 16000));
    if (update.message?.chat.type === "private" && update.message.text)
      await db().query(
        "INSERT INTO telegram_updates(id,destination,text) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [update.update_id, String(update.message.chat.id), update.message.text],
      );
    return { received: true };
  });
