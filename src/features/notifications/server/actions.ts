"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/server/audit";
import { protectedAction } from "@/server/action";
import { summarizeCounts } from "../domain/schedule-rules";
import { emptyInputSchema, markReadSchema } from "../schemas";
import { markAllNotificationsRead, setNotificationRead } from "./inbox-service";
import { runScheduledNotifications } from "./scheduler";

const INBOX = "/admin/notifications";

export const markNotificationReadAction = protectedAction(
  { name: "notifications.markRead", schema: markReadSchema, permission: "notifications:read" },
  async ({ id, read }, { user }) => {
    const res = await setNotificationRead(id, read, user);
    revalidatePath(INBOX);
    return { id: res.id, read: !!res.readAt };
  },
);

export const markAllNotificationsReadAction = protectedAction(
  { name: "notifications.markAllRead", schema: emptyInputSchema, permission: "notifications:read" },
  async (_input, { user }) => {
    const count = await markAllNotificationsRead(user);
    revalidatePath(INBOX);
    return { count };
  },
);

export const runRemindersNowAction = protectedAction(
  {
    name: "notifications.runScheduler",
    schema: emptyInputSchema,
    permission: "settings:write",
    rateLimit: { limit: 6, windowMs: 60_000 },
  },
  async (_input, { user, ip }) => {
    const result = await runScheduledNotifications();
    await audit({
      action: "notifications.scheduler_run",
      entityType: "NotificationLog",
      after: { counts: result.counts, total: result.total, failedRules: result.failedRules },
      actor: user,
      ip,
    });
    revalidatePath(INBOX);
    revalidatePath("/admin/quotes");
    return { ...result, summary: summarizeCounts(result.counts) };
  },
);
