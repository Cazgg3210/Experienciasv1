import { z } from "zod";

export const FAQ_CATEGORIES = ["general", "reservas", "pagos", "menu", "logistica"] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  general: "General",
  reservas: "Reservas",
  pagos: "Pagos",
  menu: "Menú",
  logistica: "Logística",
};

export function faqCategoryLabel(category: string): string {
  return (FAQ_CATEGORY_LABELS as Record<string, string>)[category] ?? category;
}

const id = z.string().min(1).max(40);
const order = z
  .number({ invalid_type_error: "Escribe un número", required_error: "Escribe un número" })
  .int("Número entero")
  .min(0, "No puede ser negativo")
  .max(9999, "Máximo 9999");

export const testimonialSchema = z.object({
  id: id.optional(),
  authorName: z.string().trim().min(2, "Escribe el nombre de quien opina").max(80, "Máximo 80 caracteres"),
  occasion: z.string().trim().max(80, "Máximo 80 caracteres"),
  body: z.string().trim().min(10, "Escribe el testimonio (mínimo 10 caracteres)").max(1200, "Máximo 1,200 caracteres"),
  rating: z
    .number({ invalid_type_error: "Elige una calificación" })
    .int()
    .min(1, "Mínimo 1 estrella")
    .max(5, "Máximo 5 estrellas"),
  active: z.boolean(),
  sortOrder: order,
});
export type TestimonialValues = z.infer<typeof testimonialSchema>;

export const faqSchema = z.object({
  id: id.optional(),
  question: z.string().trim().min(5, "Escribe la pregunta").max(200, "Máximo 200 caracteres"),
  answer: z.string().trim().min(5, "Escribe la respuesta").max(2000, "Máximo 2,000 caracteres"),
  category: z.enum(FAQ_CATEGORIES, { errorMap: () => ({ message: "Elige una categoría" }) }),
  /** "" = pregunta general (todas las experiencias) */
  experienceId: z.string().max(40),
  active: z.boolean(),
  sortOrder: order,
});
export type FaqValues = z.infer<typeof faqSchema>;

export const idSchema = z.object({ id });
export const moveSchema = z.object({ id, direction: z.enum(["up", "down"]) });
export const toggleActiveSchema = z.object({ id, active: z.boolean() });

export const galleryAltSchema = z.object({
  id,
  alt: z
    .string()
    .trim()
    .min(3, "Describe la imagen para quien usa lector de pantalla (mínimo 3 caracteres)")
    .max(200, "Máximo 200 caracteres"),
});
export type GalleryAltValues = z.infer<typeof galleryAltSchema>;

export const galleryFeaturedSchema = z.object({ id, featured: z.boolean() });
