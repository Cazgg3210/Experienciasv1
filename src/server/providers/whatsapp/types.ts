import type { SendResult } from "../email/types";

export type WhatsAppMessage = {
  /** Número en formato internacional sin "+", ej. 5215512345678 */
  to: string;
  body: string;
  /** Plantilla aprobada por Meta (Cloud API). En mock se ignora. */
  template?: { name: string; language: string; variables: string[] };
};

export interface WhatsAppProvider {
  readonly name: string;
  readonly isMock: boolean;
  send(message: WhatsAppMessage): Promise<SendResult>;
}
