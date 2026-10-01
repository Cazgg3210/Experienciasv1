import { randomBytes } from "node:crypto";

/** Error de dominio con mensaje seguro para mostrar al usuario (en español). */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly expose = true;
  constructor(message: string, code = "APP_ERROR", status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "No encontramos lo que buscas.") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Necesitas iniciar sesión.") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No tienes permiso para realizar esta acción.") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors?: Record<string, string[]>;
  constructor(message = "Revisa los datos ingresados.", fieldErrors?: Record<string, string[]>) {
    super(message, "VALIDATION_ERROR", 422);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class ConflictError extends AppError {
  constructor(message = "La operación entra en conflicto con el estado actual.") {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Demasiados intentos. Intenta de nuevo en unos minutos.") {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitError";
  }
}

/** ID corto de error para correlacionar logs con lo que ve el usuario (sin stack traces). */
export function newErrorId(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
