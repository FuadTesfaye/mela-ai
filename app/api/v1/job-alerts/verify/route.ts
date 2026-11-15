import { z } from "zod";
import { api, jsonBody, preflight } from "@/lib/security/http";
import { verifyCode } from "@/lib/channels/subscriptions";
import { uuid } from "@/lib/security/schemas";
export const OPTIONS = preflight;
export const POST = (request: Request) =>
  api(
    request,
    async () =>
      verifyCode(
        z
          .object({
            id: uuid,
            token: z.string().max(100),
            code: z.string().regex(/^\d{6}$/),
          })
          .parse(await jsonBody(request, 2000)),
      ),
    8,
  );
