import { api, preflight } from "@/lib/security/http";
import { sessionAccess } from "@/lib/support/tickets";
import { db } from "@/lib/database/db";
type Params = { params: Promise<{ id: string }> };
export const OPTIONS = preflight;
export const GET = (request: Request, { params }: Params) =>
  api(
    request,
    async () => {
      const { session } = await sessionAccess(request, (await params).id);
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
      return {
        active:
          session.active &&
          Date.now() - new Date(session.created_at).getTime() < 1800000,
        iceServers,
      };
    },
    120,
  );
export const DELETE = (request: Request, { params }: Params) =>
  api(request, async () => {
    const { id } = await params;
    await sessionAccess(request, id);
    await db().query("UPDATE share_sessions SET active=false WHERE id=$1", [
      id,
    ]);
    return { ok: true };
  });
