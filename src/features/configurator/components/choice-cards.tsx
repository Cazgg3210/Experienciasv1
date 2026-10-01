"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grupo de tarjetas grandes tipo radio (Radix RadioGroup): navegación con flechas,
 * roving tabindex y aria-checked accesibles.
 */
export function ChoiceGroup({
  value,
  onValueChange,
  labelledBy,
  className,
  children,
  invalid,
  describedBy,
}: {
  value: string | null;
  onValueChange: (value: string) => void;
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value ?? ""}
      onValueChange={onValueChange}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      loop
      className={cn("grid gap-3", className)}
    >
      {children}
    </RadioGroupPrimitive.Root>
  );
}

export function ChoiceCard({
  value,
  title,
  description,
  media,
  badge,
  meta,
  icon,
  disabled,
  className,
  horizontal = false,
}: {
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  media?: React.ReactNode;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  horizontal?: boolean;
}) {
  const id = React.useId();
  return (
    <RadioGroupPrimitive.Item
      value={value}
      disabled={disabled}
      aria-labelledby={`${id}-t`}
      aria-describedby={
        [description ? `${id}-d` : null, meta ? `${id}-m` : null].filter(Boolean).join(" ") || undefined
      }
      className={cn(
        "group bg-card relative flex w-full overflow-hidden rounded-2xl border text-left shadow-[0_1px_2px_rgba(47,44,42,0.04)] transition-[border-color,box-shadow,background-color] duration-200 outline-none",
        "hover:border-taupe/60 hover:shadow-[0_6px_20px_-12px_rgba(47,44,42,0.35)]",
        "focus-visible:ring-ring/50 focus-visible:border-olive focus-visible:ring-3",
        "data-[state=checked]:border-olive data-[state=checked]:bg-sage-soft/45 data-[state=checked]:ring-olive/20 data-[state=checked]:ring-2",
        "disabled:cursor-not-allowed disabled:opacity-55",
        horizontal ? "flex-col sm:flex-row" : "flex-col",
        className,
      )}
    >
      {media ? (
        <span
          className={cn(
            "bg-sand-soft relative block shrink-0 overflow-hidden",
            horizontal ? "aspect-[16/9] sm:aspect-auto sm:w-48" : "aspect-[16/10] w-full",
          )}
        >
          {media}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-4 pr-12 sm:p-5 sm:pr-12">
        {icon ? (
          <span
            aria-hidden
            className="bg-sand-soft text-olive mb-1 flex size-10 items-center justify-center rounded-full group-data-[state=checked]:bg-white/70"
          >
            {icon}
          </span>
        ) : null}
        <span className="flex flex-wrap items-center gap-2">
          <span id={`${id}-t`} className="font-heading text-xl leading-tight font-semibold text-balance">
            {title}
          </span>
          {badge}
        </span>
        {description ? (
          <span id={`${id}-d`} className="text-muted-foreground block text-sm leading-relaxed">
            {description}
          </span>
        ) : null}
        {meta ? (
          <span id={`${id}-m`} className="mt-1 block">
            {meta}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "border-input bg-card absolute top-3 right-3 flex size-6 items-center justify-center rounded-full border transition-colors",
          "group-data-[state=checked]:border-olive group-data-[state=checked]:bg-olive group-data-[state=checked]:text-ivory",
        )}
      >
        <Check className="size-3.5 opacity-0 transition-opacity group-data-[state=checked]:opacity-100" />
      </span>
    </RadioGroupPrimitive.Item>
  );
}

/** Pastilla informativa pequeña (precio, duración, invitadas). */
export function MetaPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "bg-sand-soft text-charcoal inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SoftBadge({
  children,
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  tone?: "brand" | "warning" | "muted" | "info";
  className?: string;
}) {
  const tones = {
    brand: "bg-olive text-ivory",
    warning: "bg-warning/12 text-warning border border-warning/25",
    muted: "bg-muted text-muted-foreground border border-border",
    info: "bg-info/10 text-info border border-info/20",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
