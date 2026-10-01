"use client";

import * as React from "react";

/**
 * Devuelve el foco al botón que abrió un diálogo controlado (sin <DialogTrigger>).
 * Radix sólo restaura el foco al trigger propio; con `open` controlado desde fuera el foco
 * se perdería en <body> al cerrar (Esc, Cancelar o Guardar), rompiendo la navegación por teclado.
 *
 * const onCloseAutoFocus = useReturnFocus(open);
 * <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
 */
export function useReturnFocus(open: boolean) {
  const returnTo = React.useRef<HTMLElement | null>(null);

  // Layout effect: corre antes de que el FocusScope del diálogo mueva el foco hacia adentro.
  React.useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      returnTo.current = document.activeElement;
    }
  }, [open]);

  return React.useCallback((event: Event) => {
    const el = returnTo.current;
    if (el && el.isConnected) {
      event.preventDefault();
      el.focus();
    }
  }, []);
}
