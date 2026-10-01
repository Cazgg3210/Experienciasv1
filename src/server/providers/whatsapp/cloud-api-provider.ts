import type { SendResult } from "../email/types";
import type { WhatsAppMessage, WhatsAppProvider } from "./types";

/** Meta WhatsApp Cloud API. Fuera de la ventana de 24 h sólo se permiten plantillas aprobadas. */
export class CloudApiWhatsAppProvider implements WhatsAppProvider {
  readonly name = "whatsapp-cloud-api";
  readonly isMock = false;
  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
    private readonly apiVersion = "v21.0",
  ) {}

  async send(message: WhatsAppMessage): Promise<SendResult> {
    const payload = message.template
      ? {
          messaging_product: "whatsapp",
          to: message.to,
          type: "template",
          template: {
            name: message.template.name,
            language: { code: message.template.language },
            components: [
              {
                type: "body",
                parameters: message.template.variables.map((text) => ({ type: "text", text })),
              },
            ],
          },
        }
      : { messaging_product: "whatsapp", to: message.to, type: "text", text: { body: message.body } };
    try {
      const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };
      if (!res.ok) return { status: "failed", error: body.error?.message ?? `HTTP ${res.status}` };
      return { status: "sent", providerMessageId: body.messages?.[0]?.id };
    } catch (error) {
      return { status: "failed", error: error instanceof Error ? error.message : "unknown" };
    }
  }
}
