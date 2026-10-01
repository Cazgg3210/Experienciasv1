import "server-only";
import type { AnalyticsEventType, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";

export type TrackInput = {
  sessionId?: string | null;
  path?: string | null;
  experienceId?: string | null;
  leadId?: string | null;
  quoteId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Registra un evento interno de analítica. Nunca lanza errores. */
export async function track(type: AnalyticsEventType, input: TrackInput = {}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        type,
        sessionId: input.sessionId ?? null,
        path: input.path ?? null,
        experienceId: input.experienceId ?? null,
        leadId: input.leadId ?? null,
        quoteId: input.quoteId ?? null,
        eventId: input.eventId ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (error) {
    logger.warn("analytics.track_failed", { error, type });
  }
}
