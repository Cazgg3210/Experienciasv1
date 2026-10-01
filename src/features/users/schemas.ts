import { z } from "zod";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, TEAM_ROLES } from "./domain/user-rules";

export const passwordSchema = z
  .string({ required_error: "Escribe una contraseña" })
  .min(MIN_PASSWORD_LENGTH, `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`)
  .max(MAX_PASSWORD_LENGTH, `Máximo ${MAX_PASSWORD_LENGTH} caracteres`);

const userId = z.string().min(1, "Usuario inválido").max(40, "Usuario inválido");
const role = z.enum(TEAM_ROLES, { errorMap: () => ({ message: "Elige un rol" }) });

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(80, "Máximo 80 caracteres"),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(160, "Correo demasiado largo"),
  role,
  password: passwordSchema,
  /** Ficha de staff existente a vincular (sólo rol STAFF). Vacío = ninguna */
  staffMemberId: z.string().max(40).optional(),
});
export type CreateUserValues = z.infer<typeof createUserSchema>;

export const changeRoleSchema = z.object({ userId, role });
export type ChangeRoleValues = z.infer<typeof changeRoleSchema>;

export const setActiveSchema = z.object({ userId, active: z.boolean() });

export const resetPasswordSchema = z.object({ userId, password: passwordSchema });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
