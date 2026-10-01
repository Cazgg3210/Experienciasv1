"use client";

import * as React from "react";
import type { DesignView, DesignerPageOptions } from "../types";
import { DesignResult } from "./design-result";
import { DesignerForm } from "./designer-form";
import { GeneratingState } from "./generating-state";

type Phase = "form" | "generating" | "result";

/**
 * Contenedor del flujo: formulario → generando → propuesta.
 * El formulario se mantiene montado (oculto) para conservar lo capturado al "Probar otra idea".
 */
export function DesignerStudio({
  options,
  maxStandardGuests,
}: {
  options: DesignerPageOptions;
  maxStandardGuests: number;
}) {
  const [phase, setPhase] = React.useState<Phase>("form");
  const [result, setResult] = React.useState<DesignView | null>(null);
  const topRef = React.useRef<HTMLDivElement>(null);

  const scrollToTop = React.useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    topRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div hidden={phase !== "form"}>
        <DesignerForm
          options={options}
          maxStandardGuests={maxStandardGuests}
          onStart={() => {
            setPhase("generating");
            scrollToTop();
          }}
          onDone={(design) => {
            setResult(design);
            setPhase("result");
            scrollToTop();
          }}
          onFail={() => setPhase("form")}
        />
      </div>
      {phase === "generating" ? <GeneratingState /> : null}
      {phase === "result" && result ? (
        <DesignResult
          key={result.id}
          design={result}
          onRestart={() => {
            setPhase("form");
            scrollToTop();
          }}
        />
      ) : null}
    </div>
  );
}
