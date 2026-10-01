import { generateToken } from "@/lib/tokens";
import type { EmailMessage, EmailProvider, SendResult } from "./types";

/** No envía nada: el NotificationService guarda el mensaje en NotificationLog (mock inbox). */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock-email";
  readonly isMock = true;
  async send(_message: EmailMessage): Promise<SendResult> {
    return { status: "mocked", providerMessageId: `mock_em_${generateToken(9)}` };
  }
}
