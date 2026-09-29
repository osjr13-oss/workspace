"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { brand } from "@/lib/brand";

export function SupportContactForm({
  defaultName = "",
  defaultEmail = ""
}: {
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultName) setName(defaultName);
  }, [defaultName]);

  useEffect(() => {
    if (defaultEmail) setEmail(defaultEmail);
  }, [defaultEmail]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const response = await fetch("/api/support/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, subject, message, company })
    });

    const payload = await response.json();
    if (response.ok) {
      setStatus(
        payload.emailSent
          ? `Request ${payload.ticketId} received. Check your inbox for confirmation.`
          : `Request ${payload.ticketId} received. We will respond within ${brand.support.responseSla}.`
      );
      setSubject("");
      setMessage("");
    } else {
      setStatus(payload.error || "Could not send your message.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="panel space-y-4 p-6">
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="support-name" className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
            Name
          </label>
          <input
            id="support-name"
            className="input-premium mt-2 w-full px-5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor="support-email" className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
            Email
          </label>
          <input
            id="support-email"
            className="input-premium mt-2 w-full px-5"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
      </div>
      <div>
        <label htmlFor="support-subject" className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
          Subject
        </label>
        <input
          id="support-subject"
          className="input-premium mt-2 w-full px-5"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief summary"
          required
        />
      </div>
      <div>
        <label htmlFor="support-message" className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
          Message
        </label>
        <textarea
          id="support-message"
          className="input-premium mt-2 min-h-[160px] w-full resize-y rounded-[18px] px-5 py-4"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          required
        />
      </div>
      <button type="submit" className="btn-primary" disabled={loading}>
        <Send size={18} />
        {loading ? "Sending" : "Send message"}
      </button>
      {status ? <p className="text-sm font-bold text-[var(--muted-strong)]">{status}</p> : null}
    </form>
  );
}
