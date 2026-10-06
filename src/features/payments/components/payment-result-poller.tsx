"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handleActionResult } from "@/components/forms/action-result";
import { getPaymentStatusAction, startCheckoutAction, type PaymentStatusView } from "../server/checkout-actions";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_MS = 40_000;

type Phase = "checking" | "success" | "failed" | "processing" | "refunded";

function phaseFor(view: PaymentStatusView, timedOut: boolean): Phase {
  if (view.status === "PAID" || view.status === "PARTIAL_REFUND") return "success";
  if (view.status === "FAILED") return "failed";
  if (view.status === "REFUNDED") return "refunded";
  return timedOut ? "processing" : "checking";
}

/**
 * Resultado del pago: consulta el estado (confirmado por webhook) cada 2 s hasta ~40 s.
 * Nunca da por pagado algo sólo porque la clienta volvió de la pasarela.
 */
export function PaymentResultPoller({
  p,
  s,
  initial,
  portalHref,
  retry,
  amountLabel,
  kindLabel,
  eventTitle,
  eventCancelled = false,
}: {
  p: string;
  s: string;
  initial: PaymentStatusView;
  portalHref: string;
  retry: { token: string; kind: "DEPOSIT" | "BALANCE" | "FULL" } | null;
  amountLabel: string;
  kindLabel: string;
  eventTitle: string;
  /** El evento está cancelado: un cobro tardío no se confirma como un pago normal (el equipo lo reembolsa). */
  eventCancelled?: boolean;
}) {
  const [view, setView] = React.useState<PaymentStatusView>(initial);
  const [timedOut, setTimedOut] = React.useState(false);
  const [round, setRound] = React.useState(0);
  const [retrying, setRetrying] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const phase = phaseFor(view, timedOut);

  React.useEffect(() => {
    if (view.status !== "PENDING" || timedOut) return;
    let cancelled = false;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= MAX_POLL_MS) {
        setTimedOut(true);
        return;
      }
      try {
        const res = await getPaymentStatusAction({ p, s });
        if (cancelled) return;
        if (res.ok) {
          setView(res.data);
          if (res.data.status !== "PENDING") return;
        }
      } catch {
        // red intermitente: seguimos intentando hasta el límite
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    // Al reanudar manualmente (round > 0) se consulta de inmediato.
    timer = setTimeout(tick, round > 0 ? 0 : POLL_INTERVAL_MS);
    // Límite duro: aunque una consulta se quede colgada (red lenta), a los ~40 s se muestra
    // "Tu pago se está procesando" en lugar de quedarse en "Confirmando…" indefinidamente.
    const deadline = setTimeout(() => {
      if (!cancelled) setTimedOut(true);
    }, MAX_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(deadline);
    };
  }, [p, s, view.status, timedOut, round]);

  function onCheckAgain() {
    setTimedOut(false);
    setRound((r) => r + 1);
  }

  React.useEffect(() => {
    if (phase !== "checking") headingRef.current?.focus();
  }, [phase]);

  async function onRetry() {
    if (!retry) return;
    setRetrying(true);
    try {
      const res = await startCheckoutAction({ token: retry.token, tokenType: "portal", kind: retry.kind });
      if (handleActionResult(res)) {
        window.location.assign(res.data.url);
        return;
      }
    } catch {
      handleActionResult({ ok: false, error: "No pudimos abrir el pago. Revisa tu conexión e intenta de nuevo." });
    }
    setRetrying(false);
  }

  const summary = (
    <dl className="bg-ivory/70 mx-auto mt-6 grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border px-5 py-4 text-left text-sm">
      <dt className="text-muted-foreground">Concepto</dt>
      <dd className="text-right font-medium">{kindLabel}</dd>
      <dt className="text-muted-foreground">Celebración</dt>
      <dd className="text-right font-medium">{eventTitle}</dd>
      <dt className="text-muted-foreground">Monto</dt>
      <dd className="tabular text-right font-semibold">{amountLabel}</dd>
    </dl>
  );

  return (
    <div className="text-center" aria-live="polite" aria-atomic="true">
      {phase === "checking" ? (
        <>
          <div className="bg-sage-soft text-olive mx-auto flex size-16 items-center justify-center rounded-full">
            <Loader2 className="size-7 motion-safe:animate-spin" aria-hidden />
          </div>
          <h1 className="font-heading mt-6 text-3xl font-semibold sm:text-4xl">Confirmando tu pago…</h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md">
            Estamos esperando la confirmación segura de la pasarela. Esto suele tomar sólo unos segundos; no cierres esta
            ventana.
          </p>
          {summary}
        </>
      ) : null}

      {phase === "success" ? (
        <>
          <div className="bg-success/10 text-success mx-auto flex size-16 items-center justify-center rounded-full">
            <CheckCircle2 className="size-8" aria-hidden />
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="font-heading mt-6 text-3xl font-semibold outline-none sm:text-4xl">
            {eventCancelled
              ? "Recibimos tu pago, pero tu evento está cancelado"
              : view.eventConfirmed
                ? "¡Pago recibido! Tu fecha está confirmada"
                : "¡Pago recibido!"}
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md">
            {eventCancelled
              ? "Tu celebración ya estaba cancelada cuando se completó el cobro. Ya avisamos al equipo para reembolsártelo y te contactaremos muy pronto por correo o WhatsApp."
              : "Gracias por confiar en nosotras. Te enviamos el comprobante por correo y WhatsApp. Desde tu portal puedes invitar a tus amigas, revisar el menú y contarnos todos los detalles."}
          </p>
          {view.status === "PARTIAL_REFUND" ? (
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">Una parte de este pago ya fue reembolsada.</p>
          ) : null}
          {summary}
          <Button asChild size="xl" className="mt-8">
            <Link href={portalHref}>Ir a mi evento</Link>
          </Button>
        </>
      ) : null}

      {phase === "failed" ? (
        <>
          <div className="bg-destructive/10 text-destructive mx-auto flex size-16 items-center justify-center rounded-full">
            <XCircle className="size-8" aria-hidden />
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="font-heading mt-6 text-3xl font-semibold outline-none sm:text-4xl">
            Tu pago no se completó
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md">
            {view.failureReason ?? "La pasarela no pudo procesar el cargo."} No se realizó ningún cobro.{" "}
            {eventCancelled
              ? "Si tienes dudas, escríbenos por WhatsApp."
              : "Puedes intentarlo de nuevo con otra tarjeta o escribirnos por WhatsApp."}
          </p>
          {summary}
          <div className="mt-8 flex flex-col items-center gap-3">
            {retry ? (
              <Button size="xl" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
                {retrying ? (
                  <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <RotateCcw className="size-4" aria-hidden />
                )}
                <span>{retrying ? "Abriendo pago seguro…" : "Intentar de nuevo"}</span>
              </Button>
            ) : null}
            <Link href={portalHref} className="text-olive text-sm font-medium underline-offset-4 hover:underline">
              Volver a mi evento
            </Link>
          </div>
        </>
      ) : null}

      {phase === "processing" ? (
        <>
          <div className="bg-warning/10 text-warning mx-auto flex size-16 items-center justify-center rounded-full">
            <Clock className="size-8" aria-hidden />
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="font-heading mt-6 text-3xl font-semibold outline-none sm:text-4xl">
            Tu pago se está procesando
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md">
            Tu pago se está procesando; te avisaremos por correo/WhatsApp en cuanto la pasarela lo confirme. No necesitas
            pagar de nuevo.
          </p>
          {summary}
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button asChild size="xl" variant="outline">
              <Link href={portalHref}>Ir a mi evento</Link>
            </Button>
            <button
              type="button"
              onClick={onCheckAgain}
              className="text-olive inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Revisar de nuevo
            </button>
          </div>
        </>
      ) : null}

      {phase === "refunded" ? (
        <>
          <div className="bg-muted text-muted-foreground mx-auto flex size-16 items-center justify-center rounded-full">
            <RotateCcw className="size-8" aria-hidden />
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="font-heading mt-6 text-3xl font-semibold outline-none sm:text-4xl">
            Este pago fue reembolsado
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md">
            Si tienes dudas sobre el reembolso, escríbenos y con gusto te ayudamos.
          </p>
          {summary}
          <Button asChild size="xl" variant="outline" className="mt-8">
            <Link href={portalHref}>Ir a mi evento</Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}
