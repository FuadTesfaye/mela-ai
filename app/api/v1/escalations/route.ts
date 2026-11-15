import { api, jsonBody, preflight } from "@/lib/security/http";
import { ticketSchema } from "@/lib/security/schemas";
import { createTicket } from "@/lib/support/tickets";
import { requireAdmin } from "@/lib/security/auth";
import { db } from "@/lib/database/db";
export const OPTIONS = preflight;
export const POST = (request: Request) =>
  api(
    request,
    async () =>
      Response.json(
        await createTicket(
          ticketSchema.parse(await jsonBody(request, 5000000)),
        ),
        { status: 201 },
      ),
    12,
  );
export const GET = (request: Request) =>
  api(request, async () => {
    requireAdmin(request);
    const result = await db().query(
      "SELECT id,language,status,kind,created_at FROM tickets ORDER BY created_at DESC LIMIT 100",
    );
    return { tickets: result.rows };
  });
