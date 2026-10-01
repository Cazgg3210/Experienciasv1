export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: Record<string, string>;
};

export type SendResult = {
  status: "sent" | "mocked" | "failed";
  providerMessageId?: string;
  error?: string;
};

export interface EmailProvider {
  readonly name: string;
  readonly isMock: boolean;
  send(message: EmailMessage): Promise<SendResult>;
}
