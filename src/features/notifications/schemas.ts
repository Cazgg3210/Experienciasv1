import { z } from "zod";

export const markReadSchema = z.object({
  id: z.string().min(1).max(40),
  read: z.boolean().default(true),
});

export const emptyInputSchema = z.object({}).default({});
