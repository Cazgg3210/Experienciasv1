/**
 * Cierre de sesión con la base caída: Auth.js sólo registra el error del evento `signOut` y borra la cookie de
 * todos modos, así que la revocación fallida debe quedar registrada como error alertable (no silenciosa).
 * El comportamiento con base real (comparar-e-incrementar) está en tests/integration/settings-notifications.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany, logger } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/db", () => ({ prisma: { user: { updateMany } } }));
vi.mock("@/lib/logger", () => ({ logger }));

import { revokeSessionsOnSignOut } from "./session-service";

describe("revokeSessionsOnSignOut", () => {
  beforeEach(() => {
    updateMany.mockReset();
    for (const fn of Object.values(logger)) fn.mockReset();
  });

  it("si la base falla, registra auth.logout_revocation_failed (error) y propaga el error", async () => {
    const failure = new Error("db down");
    updateMany.mockRejectedValueOnce(failure);
    await expect(revokeSessionsOnSignOut({ uid: "u1", sessionVersion: 3 })).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith("auth.logout_revocation_failed", {
      userId: "u1",
      error: failure,
    });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("compara e incrementa con la versión del token (no toca la base con tokens sin uid o con versión inválida)", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await revokeSessionsOnSignOut({ uid: "u1", sessionVersion: 3 })).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "u1", sessionVersion: 3 },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(logger.info).toHaveBeenCalledWith("auth.logout", { userId: "u1", sessionsRevoked: true });

    expect(await revokeSessionsOnSignOut({ sessionVersion: 3 })).toBe(false);
    expect(await revokeSessionsOnSignOut({ uid: "u1", sessionVersion: "3" })).toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
