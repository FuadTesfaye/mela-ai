import { z } from "zod";
import { api, jsonBody, preflight } from "@/lib/security/http";
import { ticketAccess } from "@/lib/support/tickets";
import { requireAdmin } from "@/lib/security/auth";
import { db } from "@/lib/database/db";
type Params = { params: Promise<{ id: string }> };
export const OPTIONS = preflight;
export const GET = (request: Request, { params }: Params) =>
  api(
    request,
    async () => {
      const { id } = await params;
      const { ticket, role } = await ticketAccess(request, id);
      const messages = await db().query(
        "SELECT id,content,created_at FROM tutor_messages WHERE ticket_id=$1 ORDER BY id",
        [id],
      );
      return {
        id,
        status: ticket.status,
        language: ticket.language,
        kind: ticket.kind,
        messages: messages.rows,
        ...(role === "tutor"
          ? {
              conversation: ticket.conversation,
              context: ticket.context,
              hasScreenshot: !!ticket.screenshot,
            }
          : {}),
      };
    },
    120,
  );
export const PATCH = (request: Request, { params }: Params) =>
  api(request, async () => {
    requireAdmin(request);
    const { id } = await params;
    await ticketAccess(request, id);
    const data = z
      .object({
        status: z.enum(["queued", "active", "resolved"]).optional(),
        reply: z.string().trim().min(1).max(6000).optional(),
      })
      .refine((x) => x.status || x.reply)
      .parse(await jsonBody(request, 15000));
    const client = await db().connect();
    try {
      await client.query("BEGIN");
      if (data.reply)
        await client.query(
          "INSERT INTO tutor_messages(ticket_id,content) VALUES($1,$2)",
          [id, data.reply],
        );
      await client.query(
        "UPDATE tickets SET status=COALESCE($2,status) WHERE id=$1",
        [id, data.status || (data.reply ? "active" : null)],
      );
      if (data.status === "resolved")
        await client.query(
          "UPDATE share_sessions SET active=false WHERE ticket_id=$1",
          [id],
        );
      await client.query("COMMIT");
      return { ok: true };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });
