import { randomUUID, createHmac } from "node:crypto";
import { db, closeDb } from "../lib/database/db";
import { deliver } from "../lib/channels/transports";
import { publicWebhookUrl } from "../lib/security/webhooks";
let running = true;
export async function processAlerts(limit = 20) {
  await db().query(
    "INSERT INTO alert_deliveries(subscription_id,job_id) SELECT s.id,j.id FROM subscriptions s CROSS JOIN jobs j WHERE s.active=true AND s.verified=true AND (s.keywords='' OR position(lower(s.keywords) in lower(j.data::text))>0) ON CONFLICT DO NOTHING",
  );
  for (let i = 0; i < Math.max(1, Math.min(20, limit)); i++) {
    const claimed = await db().query(
      "UPDATE alert_deliveries d SET attempts=d.attempts+1,lease_until=now()+interval '60 seconds' FROM (SELECT d.subscription_id,d.job_id FROM alert_deliveries d JOIN subscriptions s ON s.id=d.subscription_id WHERE d.status='pending' AND d.attempts<5 AND d.retry_at<=now() AND (d.lease_until IS NULL OR d.lease_until<now()) AND s.active=true AND s.verified=true ORDER BY d.retry_at FOR UPDATE OF d SKIP LOCKED LIMIT 1) q WHERE d.subscription_id=q.subscription_id AND d.job_id=q.job_id RETURNING d.*",
    );
    const item = claimed.rows[0];
    if (!item) break;
    const result = await db().query(
      "SELECT s.channel,s.destination,s.language,j.data FROM subscriptions s JOIN jobs j ON j.id=$2 WHERE s.id=$1 AND s.active=true AND s.verified=true",
      [item.subscription_id, item.job_id],
    );
    const row = result.rows[0];
    if (!row) continue;
    try {
      const url = new URL(
        "/jobs#" + item.job_id,
        process.env.APP_URL || "http://localhost:3000",
      ).href;
      const text =
        row.language === "am"
          ? `የሙከራ ሥራ: ${row.data.title}. ${url} STOP: ለማቆም`
          : `Demo job: ${row.data.title}. ${url} Reply STOP to unsubscribe.`;
      await deliver(row.channel, row.destination, text);
      await db().query(
        "UPDATE alert_deliveries SET status='sent',lease_until=null WHERE subscription_id=$1 AND job_id=$2",
        [item.subscription_id, item.job_id],
      );
    } catch {
      await db().query(
        "UPDATE alert_deliveries SET lease_until=null,retry_at=now()+($3::int * interval '1 minute') WHERE subscription_id=$1 AND job_id=$2",
        [item.subscription_id, item.job_id, Math.min(60, 2 ** item.attempts)],
      );
    }
  }
}
export async function processWebhooks(limit = 20) {
  for (let i = 0; i < Math.max(1, Math.min(20, limit)); i++) {
    const claimed = await db().query(
      "UPDATE webhook_deliveries d SET attempts=d.attempts+1,lease_until=now()+interval '60 seconds' FROM (SELECT id FROM webhook_deliveries WHERE delivered_at IS NULL AND attempts<5 AND retry_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY retry_at FOR UPDATE SKIP LOCKED LIMIT 1) q WHERE d.id=q.id RETURNING d.*",
    );
    const item = claimed.rows[0];
    if (!item) break;
    try {
      const result = await db().query(
        "SELECT url,secret FROM webhooks WHERE id=$1 AND active=true",
        [item.webhook_id],
      );
      const hook = result.rows[0];
      if (!hook) throw new Error("Disabled");
      const url = await publicWebhookUrl(hook.url);
      const body = JSON.stringify(item.payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac("sha256", hook.secret)
        .update(timestamp + "." + body)
        .digest("hex");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Mela-Delivery": item.id,
          "X-Mela-Timestamp": timestamp,
          "X-Mela-Signature": "sha256=" + signature,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Delivery failed");
      await db().query(
        "UPDATE webhook_deliveries SET delivered_at=now(),lease_until=null WHERE id=$1",
        [item.id],
      );
    } catch {
      await db().query(
        "UPDATE webhook_deliveries SET lease_until=null,retry_at=now()+($2::int * interval '1 minute') WHERE id=$1",
        [item.id, Math.min(60, 2 ** item.attempts)],
      );
    }
  }
}
export async function processTutorReplies(limit = 20) {
  const result = await db().query(
    "SELECT c.ticket_id,c.channel,c.destination,m.id,m.content FROM channel_tickets c JOIN LATERAL (SELECT id,content FROM tutor_messages WHERE ticket_id=c.ticket_id AND id>c.last_message_id ORDER BY id LIMIT 1) m ON true LIMIT $1",
    [Math.max(1, Math.min(20, limit))],
  );
  for (const row of result.rows) {
    try {
      await deliver(
        row.channel,
        row.destination,
        `MELA tutor #${row.ticket_id.slice(0, 8)}: ${row.content}`,
      );
      await db().query(
        "UPDATE channel_tickets SET last_message_id=$2 WHERE ticket_id=$1 AND last_message_id<$2",
        [row.ticket_id, row.id],
      );
    } catch {}
  }
}
async function main() {
  process.on("SIGTERM", () => {
    running = false;
  });
  process.on("SIGINT", () => {
    running = false;
  });

  console.log("Alert, webhook and tutor-reply worker started.");
  let lastCleanup = 0;
  while (running) {
    try {
      await processAlerts();
      await processWebhooks();
      await processTutorReplies();
      if (Date.now() - lastCleanup > 3600000) {
        const days = Math.max(
          1,
          Math.min(365, Number(process.env.RETENTION_DAYS) || 30),
        );
        await db().query(
          "DELETE FROM tickets WHERE created_at<now()-($1::int * interval '1 day')",
          [days],
        );
        await db().query(
          "DELETE FROM share_sessions WHERE created_at<now()-interval '1 day'",
        );
        await db().query(
          "DELETE FROM subscriptions WHERE verified=false AND verification_expires<now()-interval '1 day'",
        );
        lastCleanup = Date.now();
      }
    } catch {
      console.error("Worker services unavailable; retrying.");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  await closeDb();
}
if (process.argv[1]?.endsWith("alerts.ts"))
  main().catch(() => {
    console.error("Worker startup failed.");
    process.exitCode = 1;
  });
