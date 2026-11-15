"use client";
import { useState } from "react";
export function AlertForm() {
  const [channel, setChannel] = useState("telegram");
  const [destination, setDestination] = useState("");
  const [keywords, setKeywords] = useState("");
  const [language, setLanguage] = useState("en");
  const [consent, setConsent] = useState(false);
  const [subscription, setSubscription] = useState<{
    id: string;
    token: string;
    verified: boolean;
  }>();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/v1/job-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          destination,
          keywords,
          language,
          consent,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSubscription(data);
      setStatus(
        "A verification code was sent to your chosen channel. Enter it below.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not subscribe.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/v1/job-alerts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subscription, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSubscription((s) => (s ? { ...s, verified: true } : s));
      setStatus(
        "You’re subscribed. Demo job alerts may be sent once per listing. Send /stop on Telegram or STOP by SMS to unsubscribe.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card">
      <h2>A little nudge toward your next opportunity.</h2>
      <p>
        Opt in to demo job alerts. Your destination must be verified before any
        alerts are sent.
      </p>
      {!subscription ? (
        <form onSubmit={send}>
          <label htmlFor="channel">Delivery channel</label>
          <select
            className="field"
            id="channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="telegram">Telegram</option>
            <option value="sms">SMS</option>
          </select>
          <label htmlFor="destination">
            {channel === "telegram"
              ? "Your Telegram chat ID (start the configured bot first)"
              : "Phone number, including country code"}
          </label>
          <input
            className="field"
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={channel === "telegram" ? "123456789" : "+251…"}
            required
          />
          <label htmlFor="keywords">Job keyword (optional)</label>
          <input
            className="field"
            id="keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            maxLength={200}
          />
          <label htmlFor="alert-language">Language</label>
          <select
            className="field"
            id="alert-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="am">አማርኛ</option>
          </select>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            I agree to store this destination and receive demo job alerts.
          </label>
          <button className="button primary" disabled={busy}>
            Send verification code
          </button>
        </form>
      ) : !subscription.verified ? (
        <form onSubmit={verify}>
          <label htmlFor="code">Six-digit verification code</label>
          <input
            className="field"
            id="code"
            value={code}
            inputMode="numeric"
            pattern="[0-9]{6}"
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button className="button primary" disabled={busy}>
            Verify destination
          </button>
        </form>
      ) : (
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch(
                "/api/v1/job-alerts?id=" + subscription.id,
                {
                  method: "DELETE",
                  headers: { Authorization: "Bearer " + subscription.token },
                },
              );
              if (!r.ok)
                throw new Error(
                  "Could not unsubscribe. Send STOP in your chosen channel.",
                );
              setSubscription(undefined);
              setStatus("Unsubscribed.");
            } catch (e) {
              setStatus((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Unsubscribe
        </button>
      )}
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
    </section>
  );
}
export function AccommodationForm({ jobId }: { jobId: string }) {
  const [request, setRequest] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await fetch("/api/v1/accommodations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, request, consent: true }),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          setStatus(
            "Request queued. Reference: " +
              data.id +
              ". This demo does not contact an employer. A tutor reviews the request.",
          );
          setRequest("");
        } catch (e) {
          setStatus((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={jobId + "-request"}>
        What would help you in an interview?
      </label>
      <textarea
        className="field"
        id={jobId + "-request"}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        required
        minLength={3}
        maxLength={2000}
        placeholder="For example, written questions or extra time. No diagnosis needed."
      />
      <label className="checkbox-row">
        <input type="checkbox" required />I agree to share this request with the
        tutor team.
      </label>
      <button className="button secondary" disabled={busy}>
        Request interview support
      </button>
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
    </form>
  );
}
