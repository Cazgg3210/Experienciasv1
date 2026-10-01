import { generateToken } from "@/lib/tokens";
import type { SendResult } from "../email/types";
import type { WhatsAppMessage, WhatsAppProvider } from "./types";

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock-whatsapp";
  readonly isMock = true;
  async send(_message: WhatsAppMessage): Promise<SendResult> {
    return { status: "mocked", providerMessageId: `mock_wa_${generateToken(9)}` };
  }
}
