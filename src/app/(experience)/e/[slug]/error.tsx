"use client";

/**
 * Límite de error del segmento [slug]: atrapa fallas del layout de [token] (p. ej. la DB no
 * responde al validar el enlace), que el error.tsx de [token] no puede atrapar.
 */
import MicrositeError from "./[token]/error";

export default MicrositeError;
