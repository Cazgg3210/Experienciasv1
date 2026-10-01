"use client";

import * as React from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chips accesibles basados en inputs nativos (radio/checkbox ocultos visualmente):
 * navegación con teclado nativa, foco visible y estado anunciado por lectores de pantalla.
 */
export type ChipOption<V extends string> = {
  value: V;
  label: string;
  hint?: string;
  swatch?: string;
  icon?: LucideIcon;
};

function ChipFrame({
  legend,
  description,
  error,
  required,
  children,
  className,
  id,
}: {
  legend: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  id: string;
}) {
  return (
    <fieldset
      className={cn("min-w-0 space-y-2.5", className)}
      aria-describedby={
        [description ? `${id}-desc` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined
      }
    >
      <legend className="text-sm font-medium">
        {legend}
        {required ? (
          <span className="text-destructive ml-0.5" aria-hidden>
            *
          </span>
        ) : null}
      </legend>
      {description ? (
        <p id={`${id}-desc`} className="text-muted-foreground -mt-1 text-xs">
          {description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Chip({
  type,
  name,
  checked,
  disabled,
  onChange,
  option,
  variant,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  option: ChipOption<string>;
  variant: "pill" | "card";
}) {
  const Icon = option.icon;
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-center gap-2 border text-sm transition-colors select-none",
        "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3",
        variant === "pill" ? "min-h-11 rounded-full px-4 py-2" : "min-h-14 rounded-2xl px-3.5 py-3 text-left",
        checked
          ? "border-olive bg-olive text-ivory shadow-sm"
          : "border-border bg-card hover:border-olive/50 hover:bg-sage-soft/60",
        disabled && !checked && "hover:border-border hover:bg-card cursor-not-allowed opacity-45",
      )}
    >
      <input
        type={type}
        name={name}
        value={option.value}
        checked={checked}
        disabled={disabled && !checked}
        onChange={onChange}
        className="sr-only"
      />
      {option.swatch ? (
        <span
          aria-hidden
          className="size-5 shrink-0 rounded-full border border-black/10 shadow-inner"
          style={{ backgroundColor: option.swatch }}
        />
      ) : null}
      {Icon ? (
        <Icon aria-hidden className={cn("size-4 shrink-0", checked ? "text-ivory" : "text-olive")} />
      ) : null}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block">{option.label}</span>
        {option.hint ? (
          <span className={cn("mt-0.5 block text-xs", checked ? "text-ivory/85" : "text-muted-foreground")}>
            {option.hint}
          </span>
        ) : null}
      </span>
      {checked && type === "checkbox" ? <Check aria-hidden className="size-3.5 shrink-0" /> : null}
    </label>
  );
}

export function SingleChoiceChips<V extends string>({
  name,
  legend,
  description,
  error,
  required,
  options,
  value,
  onChange,
  variant = "pill",
  className,
  listClassName,
}: {
  name: string;
  legend: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  required?: boolean;
  options: ReadonlyArray<ChipOption<V>>;
  value: V | undefined | null;
  onChange: (value: V) => void;
  variant?: "pill" | "card";
  className?: string;
  listClassName?: string;
}) {
  const id = React.useId();
  return (
    <ChipFrame
      id={id}
      legend={legend}
      description={description}
      error={error}
      required={required}
      className={className}
    >
      <div className={cn("flex flex-wrap gap-2", listClassName)}>
        {options.map((o) => (
          <Chip
            key={o.value}
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            option={o}
            variant={variant}
          />
        ))}
      </div>
    </ChipFrame>
  );
}

export function MultiChoiceChips<V extends string>({
  name,
  legend,
  description,
  error,
  required,
  options,
  value,
  onChange,
  max,
  variant = "pill",
  className,
  listClassName,
  children,
}: {
  name: string;
  legend: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  required?: boolean;
  options: ReadonlyArray<ChipOption<V>>;
  value: V[];
  onChange: (value: V[]) => void;
  max?: number;
  variant?: "pill" | "card";
  className?: string;
  listClassName?: string;
  children?: React.ReactNode;
}) {
  const id = React.useId();
  const atMax = max != null && value.length >= max;
  return (
    <ChipFrame
      id={id}
      legend={legend}
      description={description}
      error={error}
      required={required}
      className={className}
    >
      <div className={cn("flex flex-wrap gap-2", listClassName)}>
        {options.map((o) => {
          const checked = value.includes(o.value);
          return (
            <Chip
              key={o.value}
              type="checkbox"
              name={name}
              checked={checked}
              disabled={atMax}
              onChange={() => onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])}
              option={o}
              variant={variant}
            />
          );
        })}
        {children}
      </div>
    </ChipFrame>
  );
}
