/**
 * Acceso seguro a localStorage/sessionStorage (modo privado, cuotas o bloqueos no rompen el flujo).
 */
export const DRAFT_STORAGE_KEY = "ir:configurador:v1";
export const SESSION_ID_KEY = "ir:configurador:session";
export const STARTED_FLAG_KEY = "ir:configurador:started";
export const COMPLETED_FLAG_KEY = "ir:configurador:completed";

type Kind = "local" | "session";

function store(kind: Kind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStorage(kind: Kind, key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(kind: Kind, key: string, value: string): void {
  try {
    store(kind)?.setItem(key, value);
  } catch {
    // sin espacio o bloqueado: el wizard sigue funcionando sin guardado
  }
}

export function removeStorage(kind: Kind, key: string): void {
  try {
    store(kind)?.removeItem(key);
  } catch {
    // ignorar
  }
}

/** Id aleatorio de un envío (idempotencia en servidor si se reintenta tras un corte de red). */
export function newSubmissionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Id anónimo por pestaña (sesión) para analítica del embudo. */
export function getSessionId(): string {
  const existing = readStorage("session", SESSION_ID_KEY);
  if (existing && /^[\w-]{8,64}$/.test(existing)) return existing;
  let id: string;
  try {
    id = crypto.randomUUID();
  } catch {
    id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
  writeStorage("session", SESSION_ID_KEY, id);
  return id;
}
