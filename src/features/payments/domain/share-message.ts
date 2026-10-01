/**
 * Mensaje para compartir el link de pago con la clienta por WhatsApp (texto puro, sin I/O).
 */
export function paymentLinkMessage(input: {
  customerName: string;
  eventTitle: string;
  balanceLabel: string | null; // monto formateado; null si no hay saldo
  depositLabel?: string | null; // anticipo pendiente formateado (si aún no confirma)
  dueDateLabel?: string | null;
  url: string;
  brandName?: string;
}): string {
  const first = input.customerName.trim().split(/\s+/)[0] || "";
  const hello = first ? `¡Hola, ${first}!` : "¡Hola!";
  const lines: string[] = [hello];
  if (input.depositLabel) {
    lines.push(
      `Para confirmar tu fecha de ${input.eventTitle} sólo falta el anticipo de ${input.depositLabel}. Puedes pagarlo en línea desde tu portal:`,
    );
  } else if (input.balanceLabel) {
    const due = input.dueDateLabel ? ` (fecha límite: ${input.dueDateLabel})` : "";
    lines.push(
      `Te compartimos tu portal de ${input.eventTitle}. Tu saldo pendiente es de ${input.balanceLabel}${due} y puedes pagarlo en línea aquí:`,
    );
  } else {
    lines.push(`Te compartimos tu portal de ${input.eventTitle}. Tu evento ya está pagado por completo; ahí encontrarás todos los detalles.`);
  }
  lines.push(input.url);
  lines.push(`Cualquier duda, aquí estamos. — ${input.brandName ?? "Ivonne & Rosa"}`);
  return lines.join("\n\n");
}
