"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, Info, MessageCircle } from "lucide-react";
import { CopyButton } from "@/components/data/copy-button";
import { Button } from "@/components/ui/button";
import type { SubmitConfiguratorPublicResult } from "../types";

const NEXT_STEPS = [
  {
    title: "Revisamos tu fecha",
    body: "Confirmamos disponibilidad y detalles en menos de 24 horas hábiles.",
  },
  {
    title: "Te enviamos tu cotización",
    body: "Recibes una propuesta formal por WhatsApp o correo, con todo desglosado.",
  },
  {
    title: "Apartas tu fecha",
    body: "Con el anticipo confirmas tu reserva; el resto lo liquidas unos días antes.",
  },
  {
    title: "Diseñamos juntas los detalles",
    body: "Tendrás tu portal con invitaciones, RSVP y todo lo de tu celebración.",
  },
];

export function SuccessView({
  result,
  headingRef,
  headingId,
  onRestart,
}: {
  result: SubmitConfiguratorPublicResult;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  headingId: string;
  onRestart: () => void;
}) {
  const notes: string[] = [];
  if (result.outOfArea)
    notes.push("Tu zona está fuera de nuestra cobertura actual: te contactamos para ver opciones.");
  if (result.specialRequest)
    notes.push("Por el tamaño de tu grupo, armaremos una propuesta especial para ti.");
  if (result.availabilityStatus === "FULL")
    notes.push("La fecha que elegiste está muy solicitada; te propondremos alternativas cercanas.");
  else if (result.availabilityStatus !== "AVAILABLE" && result.availabilityStatus !== "LIMITED")
    notes.push("Tu fecha queda sujeta a confirmación del equipo.");

  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-2xl py-4 text-center sm:py-8">
      <span
        aria-hidden
        className="bg-sage-soft text-olive mx-auto flex size-16 items-center justify-center rounded-full"
      >
        <CircleCheck className="size-8" />
      </span>
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="font-heading mt-6 text-4xl leading-tight font-semibold text-balance outline-none sm:text-5xl"
      >
        ¡Gracias, {result.firstName}!
      </h2>
      <p className="text-muted-foreground mx-auto mt-3 max-w-lg text-base sm:text-lg">
        Recibimos tu solicitud y ya estamos revisando la disponibilidad para tu celebración.
      </p>

      <div className="bg-card mx-auto mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border px-5 py-3">
        <span className="text-muted-foreground text-sm">Tu folio</span>
        <span className="tabular text-lg font-semibold tracking-wider">{result.code}</span>
        <CopyButton
          value={result.code}
          size="sm"
          className="rounded-full"
          label="Copiar"
          toastMessage="Folio copiado"
        />
      </div>

      {notes.length ? (
        <ul className="mx-auto mt-5 max-w-lg space-y-2 text-left">
          {notes.map((n) => (
            <li key={n} className="text-info flex gap-2 text-sm">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="bg-card mt-8 rounded-3xl border p-6 text-left sm:p-8">
        <h3 className="font-heading text-2xl font-semibold">¿Qué sigue?</h3>
        <ol className="mt-5 space-y-5">
          {NEXT_STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-4">
              <span
                aria-hidden
                className="bg-olive text-ivory flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-muted-foreground text-sm">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Button asChild size="xl">
          <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden /> Escríbenos por WhatsApp
          </a>
        </Button>
        <Button asChild size="xl" variant="outline">
          <Link href="/experiencias">Ver experiencias</Link>
        </Button>
      </div>
      <p className="text-muted-foreground mt-4 text-xs">
        Menciona tu folio {result.code} para atenderte más rápido.
      </p>
      <button
        type="button"
        onClick={onRestart}
        className="text-olive mt-6 text-sm font-medium underline-offset-4 hover:underline"
      >
        Armar otra experiencia
      </button>
    </section>
  );
}
