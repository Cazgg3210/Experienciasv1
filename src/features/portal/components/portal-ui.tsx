"use client";

import * as React from "react";

type PortalUi = {
  addGuestOpen: boolean;
  setAddGuestOpen: (open: boolean) => void;
};

const PortalUiContext = React.createContext<PortalUi | null>(null);

/** Estado de UI compartido del portal (p. ej. abrir "Agregar invitada" desde la barra inferior). */
export function PortalUiProvider({ children }: { children: React.ReactNode }) {
  const [addGuestOpen, setAddGuestOpen] = React.useState(false);
  const value = React.useMemo(() => ({ addGuestOpen, setAddGuestOpen }), [addGuestOpen]);
  return <PortalUiContext.Provider value={value}>{children}</PortalUiContext.Provider>;
}

export function usePortalUi(): PortalUi {
  const ctx = React.useContext(PortalUiContext);
  if (!ctx) throw new Error("usePortalUi debe usarse dentro de <PortalUiProvider>");
  return ctx;
}
