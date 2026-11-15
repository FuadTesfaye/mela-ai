import { z } from "zod";
import { api, jsonBody, preflight } from "@/lib/security/http";
import { language } from "@/lib/security/schemas";
import { createTicket } from "@/lib/support/tickets";
import jobs from "@/data/jobs.json";
export const OPTIONS = preflight;
export const POST = (request: Request) =>
  api(
    request,
    async () => {
      const data = z
        .object({
          jobId: z
            .string()
            .max(100)
            .refine((id) => jobs.some((j) => j.id === id)),
          request: z.string().trim().min(3).max(2000),
          language: language.default("en"),
          consent: z.literal(true),
        })
        .parse(await jsonBody(request, 10000));
      return Response.json(
        await createTicket({
          language: data.language,
          consent: true,
          kind: "accommodation",
          conversation: [
            {
              role: "user",
              content: `Interview accommodation for ${data.jobId}: ${data.request}`,
            },
          ],
        }),
        { status: 201 },
      );
    },
    12,
  );
