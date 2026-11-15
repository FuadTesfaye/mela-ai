import { test, after } from "node:test";
import { closeDb } from "../../lib/database/db";
after(() => closeDb());
import assert from "node:assert/strict";
import { POST as ask } from "../../app/api/v1/ask/route";
import {
  GET as tickets,
  POST as createTicket,
} from "../../app/api/v1/escalations/route";
import { POST as sms } from "../../app/sms/inbound/route";
import { POST as auth } from "../../app/api/v1/auth/route";
import { GET as jobs } from "../../app/api/v1/jobs/route";
import { GET as health } from "../../app/api/v1/health/route";
const origin = "http://localhost:3000";
const request = (
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
) =>
  new Request(origin + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin, ...extra },
    body: JSON.stringify(body),
  });
test("ask endpoint returns bilingual grounded answers without keys", async () => {
  const r = await ask(
    request("/api/v1/ask", { question: "browser", language: "am" }),
  );
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.provider, "none");
  assert.ok(data.citations.length);
  assert.match(data.answer, /አሳሽ/);
  assert.equal(r.headers.get("access-control-allow-origin"), origin);
});
test("ask endpoint handles retrieval miss and invalid inputs", async () => {
  const r = await ask(
    request("/api/v1/ask", { question: "xylophonic astrophysics" }),
  );
  assert.equal((await r.json()).matched, false);
  assert.equal(
    (await ask(request("/api/v1/ask", { question: "" }))).status,
    400,
  );
});
test("non-allowlisted origins cannot ask", async () => {
  const r = await ask(
    request(
      "/api/v1/ask",
      { question: "browser" },
      { origin: "https://attacker.example" },
    ),
  );
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
});
test("tickets cannot be listed without tutor authentication", async () =>
  assert.equal(
    (await tickets(new Request(origin + "/api/v1/escalations"))).status,
    401,
  ));
test("ticket creation requires affirmative consent", async () =>
  assert.equal(
    (await createTicket(request("/api/v1/escalations", { consent: false })))
      .status,
    400,
  ));
test("SMS errors also return bounded plain text", async () => {
  delete process.env.SMS_INBOUND_SECRET;
  const r = await sms(
    request("/sms/inbound", { from: "+251911000000", text: "hello" }),
  );
  assert.equal(r.status, 503);
  assert.match(r.headers.get("content-type") || "", /text\/plain/);
  assert.ok(Array.from(await r.text()).length <= 160);
});
test("demo jobs remain available without database configuration", async () => {
  const r = await jobs(new Request(origin + "/api/v1/jobs"));
  assert.equal(r.status, 200);
  assert.ok((await r.json()).jobs.length);
});
test("unconfigured authentication and database are explicit failures", async () => {
  delete process.env.ADMIN_PASSWORD;
  assert.equal(
    (await auth(request("/api/v1/auth", { password: "anything" }))).status,
    503,
  );
  if (!process.env.DATABASE_URL) assert.equal((await health()).status, 503);
});
test("cloud provider receives no question without explicit consent", async () => {
  const previous = process.env.AI_PROVIDER;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  process.env.AI_PROVIDER = "cloud";
  globalThis.fetch = async () => {
    calls++;
    throw new Error("No network expected");
  };
  try {
    const response = await ask(
      request("/api/v1/ask", { question: "password", cloudConsent: false }),
    );
    assert.equal((await response.json()).provider, "none");
    assert.equal(calls, 0);
  } finally {
    process.env.AI_PROVIDER = previous;
    globalThis.fetch = previousFetch;
  }
});
test("signing drafts, review and binary uploads require tutor authentication", async () => {
  const { GET, POST } = await import(
    "../../app/api/v1/lessons/[id]/signing/route"
  );
  const { PATCH } = await import("../../app/api/v1/signing/[id]/route");
  const { PUT } = await import("../../app/api/v1/signing/[id]/media/route");
  const params = {
    params: Promise.resolve({ id: "programming-for-beginners" }),
  };
  assert.equal(
    (
      await GET(
        new Request(
          origin + "/api/v1/lessons/programming-for-beginners/signing",
        ),
        params,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await POST(
        request("/api/v1/lessons/programming-for-beginners/signing", {}),
        params,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await PATCH(
        new Request(origin + "/api/v1/signing/draft", {
          method: "PATCH",
          headers: { origin },
        }),
        params,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await PUT(
        new Request(origin + "/api/v1/signing/draft/media", {
          method: "PUT",
          headers: { origin },
          body: "data",
        }),
        params,
      )
    ).status,
    401,
  );
});
