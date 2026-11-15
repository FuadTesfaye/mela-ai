import { test } from "node:test";
import assert from "node:assert/strict";
import { db, closeDb } from "../../lib/database/db";
import { POST as create } from "../../app/api/v1/escalations/route";
import { GET, PATCH } from "../../app/api/v1/escalations/[id]/route";
import { POST as share } from "../../app/api/v1/escalations/[id]/shares/route";
import {
  POST as signal,
  GET as getSignals,
} from "../../app/api/v1/shares/[id]/signals/route";
import { DELETE as stop } from "../../app/api/v1/shares/[id]/route";
import { createSession } from "../../lib/security/auth";
test(
  "PostgreSQL ticket authorization, tutor replies and screen signaling",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.SESSION_SECRET = "integration-test-secret-with-32-characters";
    process.env.APP_URL = "http://localhost:3000";
    const base = "http://localhost:3000";
    let id: string | undefined;
    const request = (
      path: string,
      method: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ) =>
      new Request(base + path, {
        method,
        headers: {
          origin: base,
          "Content-Type": "application/json",
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    try {
      const created = await create(
        request("/api/v1/escalations", "POST", {
          consent: true,
          conversation: [
            { role: "user", content: "Please help with browsers." },
          ],
        }),
      );
      assert.equal(created.status, 201);
      const ticket = await created.json();
      id = ticket.id;
      const params = { params: Promise.resolve({ id: id! }) };
      const learner = { Authorization: "Bearer " + ticket.token };
      const tutor = { cookie: "mela_session=" + createSession() };
      assert.equal(
        (await GET(request("/api/v1/escalations/" + id, "GET"), params)).status,
        401,
      );
      assert.equal(
        (
          await PATCH(
            request(
              "/api/v1/escalations/" + id,
              "PATCH",
              { reply: "Let’s open the browser." },
              learner,
            ),
            params,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await PATCH(
            request(
              "/api/v1/escalations/" + id,
              "PATCH",
              { reply: "Let’s open the browser." },
              tutor,
            ),
            params,
          )
        ).status,
        200,
      );
      const reply = await (
        await GET(
          request("/api/v1/escalations/" + id, "GET", undefined, learner),
          params,
        )
      ).json();
      assert.equal(reply.messages[0].content, "Let’s open the browser.");
      assert.equal(reply.conversation, undefined);
      const session = await (
        await share(
          request(
            "/api/v1/escalations/" + id + "/shares",
            "POST",
            undefined,
            learner,
          ),
          params,
        )
      ).json();
      assert.ok(session.id);
      const sessionParams = { params: Promise.resolve({ id: session.id }) };
      assert.equal(
        (
          await signal(
            request(
              "/api/v1/shares/" + session.id + "/signals",
              "POST",
              { type: "offer", sdp: "test-offer" },
              learner,
            ),
            sessionParams,
          )
        ).status,
        200,
      );
      const signals = await (
        await getSignals(
          request(
            "/api/v1/shares/" + session.id + "/signals",
            "GET",
            undefined,
            tutor,
          ),
          sessionParams,
        )
      ).json();
      assert.equal(signals.signals[0].data.type, "offer");
      assert.equal(
        (
          await signal(
            request(
              "/api/v1/shares/" + session.id + "/signals",
              "POST",
              { type: "offer", sdp: "forbidden" },
              tutor,
            ),
            sessionParams,
          )
        ).status,
        403,
      );
      await stop(
        request("/api/v1/shares/" + session.id, "DELETE", undefined, learner),
        sessionParams,
      );
      const stopped = await (
        await getSignals(
          request(
            "/api/v1/shares/" + session.id + "/signals",
            "GET",
            undefined,
            learner,
          ),
          sessionParams,
        )
      ).json();
      assert.equal(stopped.active, false);
    } finally {
      if (id) await db().query("DELETE FROM tickets WHERE id=$1", [id]);
      await closeDb();
    }
  },
);
