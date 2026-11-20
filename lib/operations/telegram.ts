import { db } from "../database/db";
import { handleCommand } from "../channels/commands";
import { telegramMessage } from "../channels/transports";
export async function processTelegramUpdates() {
  const claimed = await db().query(
    "UPDATE telegram_updates SET attempts=attempts+1,lease_until=now()+interval '120 seconds' WHERE id=(SELECT id FROM telegram_updates WHERE completed_at IS NULL AND attempts<5 AND (lease_until IS NULL OR lease_until<now()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *",
  );
  const update = claimed.rows[0];
  if (!update) return;
  try {
    const reply =
      update.reply ||
      (await handleCommand("telegram", update.destination, update.text));
    if (!update.reply)
      await db().query("UPDATE telegram_updates SET reply=$2 WHERE id=$1", [
        update.id,
        reply,
      ]);
    await telegramMessage(update.destination, reply);
    await db().query(
      "UPDATE telegram_updates SET completed_at=now(),lease_until=null WHERE id=$1",
      [update.id],
    );
  } catch {
    await db().query(
      "UPDATE telegram_updates SET lease_until=now()+interval '1 minute' WHERE id=$1",
      [update.id],
    );
  }
}
