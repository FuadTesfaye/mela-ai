import { api } from "@/lib/security/http";
import { requireOperation } from "@/lib/operations/auth";
import {
  processAlerts,
  processWebhooks,
  processTutorReplies,
} from "@/workers/alerts";
import { processTelegramUpdates } from "@/lib/operations/telegram";
import { db } from "@/lib/database/db";
export const maxDuration = 120;
export const POST = (request: Request) =>
  api(
    request,
    async () => {
      requireOperation(request);
      await Promise.all([
        processAlerts(1),
        processWebhooks(1),
        processTutorReplies(1),
        processTelegramUpdates(),
      ]);
      const days = Math.max(
        1,
        Math.min(365, Number(process.env.RETENTION_DAYS) || 30),
      );
      await db().query(
        "DELETE FROM telegram_updates WHERE created_at<now()-($1::int*interval '1 day')",
        [days],
      );
      await db().query(
        "DELETE FROM tickets WHERE created_at<now()-($1::int*interval '1 day')",
        [days],
      );
      return { processed: true };
    },
    10,
  );
