"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { protectedAction } from "@/server/action";
import { describePricingChanges, formToPricing } from "../domain/pricing-form";
import {
  availabilityFormSchema,
  businessFormSchema,
  emptySchema,
  flagResetSchema,
  flagToggleSchema,
  notificationsFormSchema,
  pricingFormSchema,
} from "../schemas";
import { patchSettings, resetFlagOverride, setFlagOverride, updateSettingsWith } from "./settings-service";
import { sendTestEmail, sendTestWhatsApp } from "./integrations-service";

function revalidateSettings(path: string) {
  revalidatePath(path);
  revalidatePath("/admin/settings", "layout");
}

export const updateBusinessSettingsAction = protectedAction(
  { name: "settings.updateBusiness", schema: businessFormSchema, permission: "settings:write" },
  async (input, { user }) => {
    await patchSettings(
      "business",
      { ...input, instagramHandle: input.instagramHandle.replace(/^@/, "") },
      user,
    );
    revalidateSettings("/admin/settings");
    // El sitio público muestra marca, contacto y políticas
    revalidatePath("/", "layout");
    revalidateTag("settings");
    return { saved: true };
  },
);

export const updatePricingSettingsAction = protectedAction(
  { name: "settings.updatePricing", schema: pricingFormSchema, permission: "settings:write" },
  async (input, { user }) => {
    // Se aplica sobre la configuración vigente leída bajo lock (no sobre una copia en caché)
    const { before, after } = await updateSettingsWith("pricing", (current) => formToPricing(input, current), user);
    revalidateSettings("/admin/settings/pricing");
    revalidateTag("settings");
    return { saved: true, changes: describePricingChanges(before, after) };
  },
);

export const updateAvailabilitySettingsAction = protectedAction(
  { name: "settings.updateAvailability", schema: availabilityFormSchema, permission: "settings:write" },
  async (input, { user }) => {
    await patchSettings("availability", input, user);
    revalidateSettings("/admin/settings/availability");
    revalidateTag("settings");
    return { saved: true };
  },
);

export const updateNotificationSettingsAction = protectedAction(
  { name: "settings.updateNotifications", schema: notificationsFormSchema, permission: "settings:write" },
  async (input, { user }) => {
    await patchSettings("notifications", input, user);
    revalidateSettings("/admin/settings/notifications");
    return { saved: true };
  },
);

export const setFeatureFlagAction = protectedAction(
  { name: "settings.setFlag", schema: flagToggleSchema, permission: "settings:write" },
  async ({ flag, enabled }, { user }) => {
    const state = await setFlagOverride(flag, enabled, user);
    revalidateSettings("/admin/settings/flags");
    revalidatePath("/", "layout");
    revalidateTag("settings");
    return state;
  },
);

export const resetFeatureFlagAction = protectedAction(
  { name: "settings.resetFlag", schema: flagResetSchema, permission: "settings:write" },
  async ({ flag }, { user }) => {
    const state = await resetFlagOverride(flag, user);
    revalidateSettings("/admin/settings/flags");
    revalidatePath("/", "layout");
    revalidateTag("settings");
    return state;
  },
);

export const sendTestEmailAction = protectedAction(
  {
    name: "settings.sendTestEmail",
    schema: emptySchema,
    permission: "settings:write",
    rateLimit: { limit: 10, windowMs: 10 * 60_000 },
  },
  async (_input, { user }) => {
    const res = await sendTestEmail(user);
    revalidatePath("/admin/notifications");
    return res;
  },
);

export const sendTestWhatsAppAction = protectedAction(
  {
    name: "settings.sendTestWhatsApp",
    schema: emptySchema,
    permission: "settings:write",
    rateLimit: { limit: 10, windowMs: 10 * 60_000 },
  },
  async (_input, { user }) => {
    const res = await sendTestWhatsApp(user);
    revalidatePath("/admin/notifications");
    return res;
  },
);
