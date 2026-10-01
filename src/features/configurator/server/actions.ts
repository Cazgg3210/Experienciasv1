"use server";

import { revalidatePath } from "next/cache";
import { publicAction } from "@/server/action";
import { track } from "@/server/analytics";
import {
  availabilityQuerySchema,
  estimateSelectionSchema,
  submitConfiguratorSchema,
  trackConfiguratorSchema,
} from "../schemas";
import type { SubmitConfiguratorPublicResult } from "../types";
import {
  estimateConfiguration,
  getConfiguratorAvailability,
  submitConfigurator,
} from "./configurator-service";

/** Disponibilidad por día para el calendario del configurador. */
export const getAvailabilityAction = publicAction(
  {
    name: "configurator.availability",
    schema: availabilityQuerySchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (input) => getConfiguratorAvailability(input),
);

/** Estimado público recalculado en servidor (sin costos ni márgenes). */
export const estimateAction = publicAction(
  {
    name: "configurator.estimate",
    schema: estimateSelectionSchema,
    rateLimit: { limit: 120, windowMs: 60_000 },
  },
  async (input) => estimateConfiguration(input),
);

/** Envío final del configurador: crea lead + snapshot con el estimado recalculado. */
export const submitConfiguratorAction = publicAction(
  {
    name: "configurator.submit",
    schema: submitConfiguratorSchema,
    rateLimit: { limit: 5, windowMs: 10 * 60_000 },
  },
  async (input, ctx): Promise<SubmitConfiguratorPublicResult> => {
    const r = await submitConfigurator(input, { actor: ctx.user });
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return {
      code: r.code,
      firstName: r.firstName,
      whatsappUrl: r.whatsappUrl,
      outOfArea: r.outOfArea,
      specialRequest: r.specialRequest,
      availabilityStatus: r.availabilityStatus,
      totalCents: r.totalCents,
    };
  },
);

/** Analítica del embudo: sólo inicio y llegada al resumen. */
export const trackConfiguratorAction = publicAction(
  { name: "configurator.track", schema: trackConfiguratorSchema, rateLimit: { limit: 20, windowMs: 60_000 } },
  async ({ type, sessionId }) => {
    await track(type, { sessionId, path: "/crear-experiencia" });
    return { tracked: true };
  },
);
