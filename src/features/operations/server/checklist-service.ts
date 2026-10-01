import "server-only";

/**
 * STUB — lo implementa el módulo Operaciones.
 * Contrato: crea (idempotente) los EventChecklistItem del evento a partir de los
 * ChecklistTemplate activos (generales + específicos de la experiencia), con dueAt = startsAt + offsetMinutes.
 * Devuelve cuántos ítems se crearon (0 si ya existían).
 */
export async function instantiateChecklistsForEvent(_eventId: string): Promise<{ created: number }> {
  return { created: 0 };
}
