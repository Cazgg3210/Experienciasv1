import type { EmailMessage, EmailProvider, SendResult } from "./types";

/** Resend (https://resend.com) vía HTTP, sin SDK. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  readonly isMock = false;
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
          tags: message.tags ? Object.entries(message.tags).map(([name, value]) => ({ name, value })) : undefined,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { status: "failed", error: body.message ?? `HTTP ${res.status}` };
      return { status: "sent", providerMessageId: body.id };
    } catch (error) {
      return { status: "failed", error: error instanceof Error ? error.message : "unknown" };
    }
  }
}
