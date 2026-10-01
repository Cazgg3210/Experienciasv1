import "server-only";
import { logger } from "@/lib/logger";
import { instantiateChecklistsForEvent } from "@/features/operations/server/checklist-service";
import { reserveInventoryForEvent } from "@/features/inventory/server/reservation-service";

/**
 * Hooks del ciclo de vida del evento. Se invocan desde los servicios que cambian estado
 * (webhook de pago, confirmación manual, admin). Idempotentes y tolerantes a fallos.
 */
export async function onEventConfirmed(eventId: string): Promise<void> {
  try {
    await instantiateChecklistsForEvent(eventId);
  } catch (error) {
    logger.error("lifecycle.checklists_failed", { error, eventId });
  }
  try {
    const { shortages } = await reserveInventoryForEvent(eventId);
    if (shortages.length) logger.warn("lifecycle.inventory_shortages", { eventId, shortages: shortages.length });
  } catch (error) {
    logger.error("lifecycle.inventory_failed", { error, eventId });
  }
}
