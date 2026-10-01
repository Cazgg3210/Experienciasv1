"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { publicAction } from "@/server/action";
import { rateLimit } from "@/lib/rate-limit";
import { sha256 } from "@/lib/tokens";
import { logger } from "@/lib/logger";
import { PORTAL_ACCESS_NEUTRAL_MESSAGE } from "../domain/portal";
import {
  portalAccessFormSchema,
  sendHostMessageSchema,
  submitReviewSchema,
  updateAddressSchema,
  updatePreferencesSchema,
} from "../schemas";
import { requestPortalAccess, resolvePortalEvent } from "./portal-service";
import {
  sendHostMessage,
  submitHostReview,
  updateHostAddress,
  updateHostPreferences,
} from "./host-service";

const TEN_MINUTES = 10 * 60_000;
const FIFTEEN_MINUTES = 15 * 60_000;

async function revalidatePortal(token: string) {
  revalidatePath(`/mi-evento/${token}`);
  revalidatePath(`/mi-evento/${token}/resumen`);
  const event = await resolvePortalEvent(token);
  if (event) {
    revalidatePath(`/admin/events/${event.id}`);
    revalidatePath(`/e/${event.micrositeSlug}/${event.inviteToken}`);
  }
}

/**
 * "Entra a tu evento": SIEMPRE responde lo mismo (sin enumeración de cuentas).
 * Rate limit 5/15 min por IP (wrapper) y por email (aquí). El envío ocurre después de
 * responder (after) para que el tiempo de respuesta tampoco revele si la cuenta existe.
 */
export const requestPortalAccessAction = publicAction(
  {
    name: "portal.request_access",
    schema: portalAccessFormSchema,
    rateLimit: { limit: 5, windowMs: FIFTEEN_MINUTES },
  },
  async ({ email }): Promise<{ message: string }> => {
    const normalized = email.trim().toLowerCase();
    const perEmail = await rateLimit(`portal-access:email:${sha256(normalized)}`, {
      limit: 5,
      windowMs: FIFTEEN_MINUTES,
    });
    if (perEmail.ok) {
      after(async () => {
        try {
          await requestPortalAccess(normalized);
        } catch (error) {
          logger.error("portal.access_after_failed", { error });
        }
      });
    }
    return { message: PORTAL_ACCESS_NEUTRAL_MESSAGE };
  },
);

export const updatePreferencesAction = publicAction(
  { name: "portal.update_preferences", schema: updatePreferencesSchema, rateLimit: { limit: 15, windowMs: TEN_MINUTES } },
  async ({ token, ...values }, { ip }) => {
    const res = await updateHostPreferences(token, values, { ip });
    await revalidatePortal(token);
    return { changed: res.changed.length };
  },
);

export const updateAddressAction = publicAction(
  { name: "portal.update_address", schema: updateAddressSchema, rateLimit: { limit: 10, windowMs: TEN_MINUTES } },
  async ({ token, ...values }, { ip }) => {
    const res = await updateHostAddress(token, values, { ip });
    await revalidatePortal(token);
    return { changed: res.changed.length };
  },
);

export const sendHostMessageAction = publicAction(
  { name: "portal.send_message", schema: sendHostMessageSchema, rateLimit: { limit: 20, windowMs: TEN_MINUTES } },
  async ({ token, body }) => {
    const msg = await sendHostMessage(token, { body });
    await revalidatePortal(token);
    return { id: msg.id };
  },
);

export const submitReviewAction = publicAction(
  { name: "portal.submit_review", schema: submitReviewSchema, rateLimit: { limit: 5, windowMs: TEN_MINUTES } },
  async ({ token, ...values }) => {
    const res = await submitHostReview(token, values);
    await revalidatePortal(token);
    return res;
  },
);
