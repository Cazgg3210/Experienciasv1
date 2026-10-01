"use client";

import { toast } from "sonner";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionResult } from "@/server/action";

/**
 * Procesa el resultado de una Server Action en el cliente:
 *  - éxito: toast + callback
 *  - error: toast con mensaje seguro (+ referencia) y errores por campo en el formulario
 *
 * const res = await createLead(values);
 * if (handleActionResult(res, { form, success: "Lead creado" })) router.push(...)
 */
export function handleActionResult<T, F extends FieldValues = FieldValues>(
  result: ActionResult<T>,
  opts: { form?: UseFormReturn<F>; success?: string | false } = {},
): result is { ok: true; data: T } {
  if (result.ok) {
    if (opts.success !== false && opts.success) toast.success(opts.success);
    return true;
  }
  if (opts.form && result.fieldErrors) {
    for (const [field, messages] of Object.entries(result.fieldErrors)) {
      if (field === "_form") continue;
      opts.form.setError(field as Path<F>, { type: "server", message: messages[0] });
    }
  }
  toast.error(result.error);
  return false;
}
