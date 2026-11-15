import { db, closeDb } from "../lib/database/db";
import { handleCommand } from "../lib/channels/commands";
import { telegramMessage } from "../lib/channels/transports";
let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required. Worker not started.");
    return;
  }
  const state = await db().query(
    "SELECT value FROM worker_state WHERE name='telegram_offset'",
  );
  let offset = Number(state.rows[0]?.value || 0);
  while (running) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offset,
            timeout: 20,
            allowed_updates: ["message"],
          }),
          signal: AbortSignal.timeout(25000),
        },
      );
      if (!response.ok) throw new Error("Telegram unavailable");
      const result = await response.json();
      if (!result.ok) throw new Error("Telegram unavailable");
      for (const update of result.result) {
        const message = update.message;
        if (
          message?.chat?.type === "private" &&
          typeof message.text === "string"
        ) {
          const destination = String(message.chat.id);
          let text: string;
          try {
            text = await handleCommand(
              "telegram",
              destination,
              message.text.slice(0, 2000),
            );
          } catch {
            text =
              "MELA could not complete that request. Please try again, or /help for tutor support.";
          }
          await telegramMessage(destination, text);
        }
        offset = update.update_id + 1;
        await db().query(
          "INSERT INTO worker_state(name,value) VALUES('telegram_offset',$1) ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value",
          [JSON.stringify(offset)],
        );
      }
    } catch {
      console.error("Telegram temporarily unavailable; retrying.");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  await closeDb();
}
main().catch(() => {
  console.error("Telegram worker requires a migrated PostgreSQL database.");
  process.exitCode = 1;
});
