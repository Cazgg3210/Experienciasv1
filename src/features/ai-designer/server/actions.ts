"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { isEnabled } from "@/lib/flags";
import { publicAction } from "@/server/action";
import { convertDesignSchema, designerInputSchema } from "../schemas";
import type { ConvertDesignResult, DesignView } from "../types";
import { convertDesignToLead, generateDesign } from "./designer-service";

const TEN_MINUTES = 10 * 60_000;

async function assertEnabled() {
  if (!(await isEnabled("AI_DESIGNER_ENABLED"))) {
    throw new AppError(
      "El diseñador con IA no está disponible por ahora. Puedes crear tu experiencia paso a paso.",
      "FEATURE_DISABLED",
      403,
    );
  }
}

/** Genera una propuesta (pública, 8 por 10 min por IP). */
export const generateDesignAction = publicAction(
  {
    name: "ai_designer.generate",
    schema: designerInputSchema,
    rateLimit: { limit: 8, windowMs: TEN_MINUTES },
  },
  async (input, { user }): Promise<DesignView> => {
    await assertEnabled();
    return generateDesign(input, { actor: user });
  },
);

/** "Quiero esta experiencia": crea el lead con source AI_DESIGNER (pública, 5 por 10 min por IP). */
export const convertDesignToLeadAction = publicAction(
  {
    name: "ai_designer.convert",
    schema: convertDesignSchema,
    rateLimit: { limit: 5, windowMs: TEN_MINUTES },
  },
  async (input, { user }): Promise<ConvertDesignResult> => {
    await assertEnabled();
    const result = await convertDesignToLead(input, { actor: user });
    if (!result.alreadySubmitted) {
      revalidatePath("/admin/leads");
      revalidatePath("/admin");
    }
    return result;
  },
);
