"use client";

import { useState } from "react";
import { Eye, EyeOff, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/data/copy-button";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Contraseña temporal aleatoria (14 caracteres, sin caracteres ambiguos). */
export function generateTempPassword(length = 14): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/**
 * Campo de contraseña temporal con botón "Generar", mostrar/ocultar y copiar.
 * Se usa dentro de <Field>: recibe los props de accesibilidad y los de register().
 */
export function PasswordField({
  value,
  onGenerate,
  inputProps,
}: {
  value: string;
  onGenerate: (password: string) => void;
  inputProps: React.ComponentProps<"input">;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          {...inputProps}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          spellCheck={false}
          className="pr-10 font-mono"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onGenerate(generateTempPassword());
            setVisible(true);
          }}
        >
          <Wand2 aria-hidden />
          Generar segura
        </Button>
        {value ? <CopyButton value={value} size="sm" label="Copiar" toastMessage="Contraseña copiada" /> : null}
      </div>
    </div>
  );
}
