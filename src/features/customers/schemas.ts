import { z } from "zod";

const phoneDigits = (v: string) => v.replace(/\D/g, "");

const optionalPhone = (label: string) =>
  z
    .string()
    .trim()
    .max(30, `${label} demasiado largo`)
    .optional()
    .refine((v) => {
      if (!v) return true;
      const d = phoneDigits(v);
      return /^[+\d\s().-]+$/.test(v) && d.length >= 10 && d.length <= 15;
    }, "Escribe un número de 10 dígitos (puedes incluir lada +52)");

export const updateCustomerSchema = z.object({
  customerId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(2, "Escribe el nombre").max(120, "Máximo 120 caracteres"),
  email: z
    .string()
    .trim()
    .max(160, "Correo demasiado largo")
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Escribe un correo válido"),
  phone: optionalPhone("Teléfono"),
  whatsapp: optionalPhone("WhatsApp"),
  instagram: z
    .string()
    .trim()
    .max(80, "Máximo 80 caracteres")
    .optional()
    .refine((v) => !v || /^[@\w.\-/:]+$/.test(v), "Escribe el usuario de Instagram (p. ej. @sofi.brunch)"),
  notes: z.string().trim().max(4000, "Máximo 4000 caracteres").optional(),
  marketingOptIn: z.boolean(),
});
export type UpdateCustomerInput = z.output<typeof updateCustomerSchema>;

export const deleteCustomerSchema = z.object({
  customerId: z.string().trim().min(1).max(64),
});
export type DeleteCustomerInput = z.output<typeof deleteCustomerSchema>;
