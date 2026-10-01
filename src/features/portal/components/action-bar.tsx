"use client";

import Link from "next/link";
import { CreditCard, FileText, Link2, Loader2, Send, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText, shareOrCopy } from "./clipboard";
import { usePortalUi } from "./portal-ui";
import { usePortalCheckout, type PayKind } from "./pay-button";

const itemCls =
  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-medium leading-tight text-charcoal transition-colors hover:bg-sage-soft focus-visible:bg-sage-soft disabled:opacity-50 sm:min-w-[5.5rem] sm:text-xs";

/**
 * Barra de acciones fija abajo (móvil) / píldora flotante (escritorio):
 * invitación, link, pagar, agregar invitada y resumen.
 */
export function ActionBar({
  token,
  title,
  invitationText,
  inviteUrl,
  summaryHref,
  pay,
  canAddGuests,
  canShareInvites,
}: {
  token: string;
  title: string;
  invitationText: string;
  inviteUrl: string;
  summaryHref: string;
  pay: { kind: PayKind; label: string } | null;
  canAddGuests: boolean;
  /** false si el micrositio está desactivado o el evento ya cerró: no se ofrecen links que darían 404 */
  canShareInvites: boolean;
}) {
  const { setAddGuestOpen } = usePortalUi();
  const checkout = usePortalCheckout(token);

  return (
    <nav
      aria-label="Acciones rápidas"
      className={cn(
        "bg-card/95 supports-backdrop-filter:bg-card/85 fixed inset-x-0 bottom-0 z-40 border-t px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(47,44,42,0.18)] backdrop-blur",
        "md:inset-x-auto md:bottom-5 md:left-1/2 md:-translate-x-1/2 md:rounded-full md:border md:px-3 md:py-1.5 md:shadow-lg",
        "print:hidden",
      )}
    >
      <ul className="mx-auto flex max-w-xl items-stretch gap-1">
        {canShareInvites ? (
          <>
            <li className="flex flex-1">
              <button
                type="button"
                className={itemCls}
                onClick={() =>
                  shareOrCopy({ title, text: invitationText }, "Invitación copiada. Pégala en tu grupo de WhatsApp.")
                }
                aria-label="Copiar invitación para compartir"
              >
                <Send className="size-5" aria-hidden />
                <span>Invitación</span>
              </button>
            </li>
            <li className="flex flex-1">
              <button
                type="button"
                className={itemCls}
                onClick={() => copyText(inviteUrl, "Link de la invitación copiado")}
                aria-label="Copiar link de la invitación"
              >
                <Link2 className="size-5" aria-hidden />
                <span>Copiar link</span>
              </button>
            </li>
          </>
        ) : null}
        {pay ? (
          <li className="flex flex-1">
            <button
              type="button"
              className={cn(itemCls, "bg-olive text-ivory hover:bg-olive/90 focus-visible:bg-olive/90")}
              onClick={() => checkout.pay(pay.kind)}
              disabled={checkout.pending}
              aria-busy={checkout.pending || undefined}
            >
              {checkout.pending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <CreditCard className="size-5" aria-hidden />
              )}
              <span>{pay.kind === "DEPOSIT" ? "Pagar anticipo" : "Pagar saldo"}</span>
            </button>
          </li>
        ) : null}
        {canAddGuests ? (
          <li className="flex flex-1">
            <button type="button" className={itemCls} onClick={() => setAddGuestOpen(true)}>
              <UserPlus className="size-5" aria-hidden />
              <span>Agregar invitada</span>
            </button>
          </li>
        ) : null}
        <li className="flex flex-1">
          <Link href={summaryHref} className={itemCls} prefetch={false}>
            <FileText className="size-5" aria-hidden />
            <span>Resumen</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
