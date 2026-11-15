import { randomUUID } from "node:crypto";
import { api, preflight } from "@/lib/security/http";
import { ticketAccess } from "@/lib/support/tickets";
import { HttpError } from "@/lib/security/auth";
import { db } from "@/lib/database/db";
type Params = { params: Promise<{ id: string }> };
export const OPTIONS = preflight;
export const GET = (request: Request, { params }: Params) =>
  api(
    request,
    async () => {
      const { id } = await params;
      await ticketAccess(request, id);
      const result = await db().query(
        "SELECT id FROM share_sessions WHERE ticket_id=$1 AND active=true AND created_at>now()-interval '30 minutes' ORDER BY created_at DESC LIMIT 1",
        [id],
      );
      return { session: result.rows[0] || null };
    },
    120,
  );
export const POST = (request: Request, { params }: Params) =>
  api(request, async () => {
    const { id } = await params;
    const { ticket, role } = await ticketAccess(request, id);
    if (role !== "learner" || ticket.status === "resolved")
      throw new HttpError(403, "Learner-controlled sharing only.");
    const session = randomUUID();
    const client = await db().connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE share_sessions SET active=false WHERE ticket_id=$1",
        [id],
      );
      await client.query(
        "INSERT INTO share_sessions(id,ticket_id) VALUES($1,$2)",
        [session, id],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    const iceServers: RTCIceServer[] = process.env.STUN_URL
      ? [{ urls: process.env.STUN_URL }]
      : [];
    if (
      process.env.TURN_URL &&
      process.env.TURN_USERNAME &&
      process.env.TURN_CREDENTIAL
    )
      iceServers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      });
    return { id: session, iceServers };
  });
