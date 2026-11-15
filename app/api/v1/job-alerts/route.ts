import { z } from "zod";
import { api, jsonBody, preflight } from "@/lib/security/http";
import { subscribe } from "@/lib/channels/subscriptions";
import { db } from "@/lib/database/db";
import { language, uuid } from "@/lib/security/schemas";
import { hash, bearer, HttpError } from "@/lib/security/auth";
export const OPTIONS = preflight;
export const POST = (request: Request) =>
  api(
    request,
    async () => {
      const input = z
        .object({
          channel: z.enum(["telegram", "sms"]),
          destination: z.string().trim().max(30),
          language: language.default("en"),
          keywords: z.string().max(200).default(""),
          consent: z.literal(true),
        })
        .refine((d) =>
          d.channel === "sms"
            ? /^\+[1-9]\d{7,14}$/.test(d.destination)
            : /^-?\d{1,20}$/.test(d.destination),
        )
        .parse(await jsonBody(request, 2000));
      return Response.json(await subscribe(input), { status: 201 });
    },
    5,
  );
export const DELETE = (request: Request) =>
  api(request, async () => {
    const id = uuid.parse(new URL(request.url).searchParams.get("id"));
    const result = await db().query(
      "UPDATE subscriptions SET active=false WHERE id=$1 AND token_hash=$2 RETURNING id",
      [id, hash(bearer(request))],
    );
    if (!result.rowCount)
      throw new HttpError(401, "Subscription access required.");
    return { unsubscribed: true };
  });
