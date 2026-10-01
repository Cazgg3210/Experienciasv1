import type { ConfiguratorDraft } from "../../domain/wizard";
import type { ConfiguratorCatalog } from "../../types";

export type StepProps = {
  draft: ConfiguratorDraft;
  update: (patch: Partial<ConfiguratorDraft>) => void;
  catalog: ConfiguratorCatalog;
  /** id del título del paso (para aria-labelledby de los grupos) */
  labelledBy: string;
  /** id del mensaje de error del paso (aria-describedby) cuando hay error */
  errorId?: string;
  invalid?: boolean;
};
