/** Explicitly creates one clearly labelled support-test ticket and resolves it.
 * Never logs credentials, session cookies or learner ticket tokens.
 */
const origin = new URL(
  process.env.VERIFY_BASE_URL || process.env.APP_URL || "http://localhost:3000",
).origin;
const request = async (path, method = "GET", body, headers = {}) => {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `${method} ${path.replace(/[0-9a-f-]{36}/g, "[ticket]")} failed (${response.status}).`,
    );
  return response;
};
async function main() {
  const health = await (await request("/api/v1/health")).json();
  if (health.database !== "ready" || health.catalogue !== "ready")
    throw new Error("Hosted database/catalogue is not ready.");
  console.log("PASS: hosted database, migrations and course catalogue.");
  const defaultAnswer = await (
    await request("/api/v1/ask", "POST", {
      question: "What is shaping the future of virtual assistant work?",
    })
  ).json();
  if (
    !defaultAnswer.matched ||
    !defaultAnswer.citations.every((c) => c.id.startsWith("va-foundations-"))
  )
    throw new Error("Default Savanna course check failed.");
  console.log("PASS: context-free Savanna answer.");
  for (const [language, question] of [
    ["en", "What is quantization?"],
    ["am", "ኳንታይዜሽን ምንድን ነው?"],
  ]) {
    const answer = await (
      await request("/api/v1/ask", "POST", {
        question,
        language,
        context: {
          pageType: "lesson",
          courseId: "offline-first-localized-ai",
          sections: [],
        },
      })
    ).json();
    if (!answer.matched || answer.language !== language)
      throw new Error(`The ${language} course answer needs attention.`);
    console.log(`PASS: ${language} course answer with sources.`);
  }
  const miss = await (
    await request("/api/v1/ask", "POST", {
      question: "xylophonic astrophysics",
    })
  ).json();
  if (miss.matched) throw new Error("Off-topic question unexpectedly matched.");
  console.log("PASS: off-topic fallback.");
  if (!process.env.ADMIN_PASSWORD)
    throw new Error("Set ADMIN_PASSWORD privately to verify a tutor reply.");
  const auth = await request("/api/v1/auth", "POST", {
    password: process.env.ADMIN_PASSWORD,
  });
  const cookie = auth.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Tutor session was not issued.");
  const ticket = await (
    await request("/api/v1/escalations", "POST", {
      consent: true,
      conversation: [
        {
          role: "user",
          content:
            "MELA automated hosted-readiness test. Please ignore this test ticket.",
        },
      ],
    })
  ).json();
  try {
    await request(
      "/api/v1/escalations/" + ticket.id,
      "PATCH",
      { reply: "Hosted readiness test reply.", status: "active" },
      { Cookie: cookie },
    );
    const result = await (
      await request("/api/v1/escalations/" + ticket.id, "GET", undefined, {
        Authorization: "Bearer " + ticket.token,
      })
    ).json();
    if (
      !result.messages.some((m) => m.content === "Hosted readiness test reply.")
    )
      throw new Error("Learner did not receive the tutor reply.");
    console.log(
      "PASS: persisted learner ticket, tutor reply and authorised learner read.",
    );
  } finally {
    await request(
      "/api/v1/escalations/" + ticket.id,
      "PATCH",
      { status: "resolved" },
      { Cookie: cookie },
    );
  }
  console.log(
    "Hosted checks passed. Still rehearse keyboard, microphone and real-device accessibility manually.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Hosted verification failed.",
  );
  process.exitCode = 1;
});
