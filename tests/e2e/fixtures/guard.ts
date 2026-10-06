/**
 * Vigilante de errores de consola y red. Se adjunta automáticamente a cada página de cada prueba.
 * Una pantalla que "se ve bien" pero produce errores de consola, excepciones no capturadas,
 * requests fallidos o respuestas 5xx NO se considera aprobada.
 *
 * Errores esperados (p. ej. el 404 de una prueba de "página no encontrada") se declaran con
 * guard.allow(/patrón/) dentro de la prueba, para que quede explícito y revisable.
 */
import type { Page, Request, Response } from "@playwright/test";

export type GuardEntry = { kind: "console" | "pageerror" | "requestfailed" | "http5xx" | "http4xx"; text: string; url?: string };

// Ruido benigno conocido de navegadores/Next (no son defectos de la app).
const BENIGN: RegExp[] = [
  /net::ERR_ABORTED/i, // prefetch/RSC cancelado al navegar
  /NS_BINDING_ABORTED/i, // equivalente en Firefox
  /Load request cancelled/i, // WebKit
  /Download the React DevTools/i,
];

export class ErrorGuard {
  readonly entries: GuardEntry[] = [];
  private readonly allowed: RegExp[] = [];
  private readonly pages = new Set<Page>();

  watch(page: Page): void {
    if (this.pages.has(page)) return;
    this.pages.add(page);
    page.on("console", (msg) => {
      if (msg.type() === "error") this.entries.push({ kind: "console", text: msg.text(), url: page.url() });
    });
    page.on("pageerror", (err) => this.entries.push({ kind: "pageerror", text: `${err.name}: ${err.message}`, url: page.url() }));
    page.on("requestfailed", (req: Request) =>
      this.entries.push({ kind: "requestfailed", text: `${req.method()} ${req.url()} — ${req.failure()?.errorText ?? ""}`, url: req.url() }),
    );
    page.on("response", (res: Response) => {
      const s = res.status();
      if (s >= 500) this.entries.push({ kind: "http5xx", text: `${s} ${res.request().method()} ${res.url()}`, url: res.url() });
      else if (s >= 400) this.entries.push({ kind: "http4xx", text: `${s} ${res.request().method()} ${res.url()}`, url: res.url() });
    });
  }

  /** Declara un error esperado para ESTA prueba (se documenta en el reporte). */
  allow(pattern: RegExp): void {
    this.allowed.push(pattern);
  }

  private isAllowed(e: GuardEntry): boolean {
    return [...BENIGN, ...this.allowed].some((r) => r.test(e.text));
  }

  /** Lo que hace fallar la prueba: consola, excepciones, requests fallidos y 5xx no declarados. */
  violations(): GuardEntry[] {
    return this.entries.filter((e) => e.kind !== "http4xx" && !this.isAllowed(e));
  }

  /** 4xx no declarados: no fallan solos (muchos son esperados), pero se reportan como observación. */
  unexpected4xx(): GuardEntry[] {
    return this.entries.filter((e) => e.kind === "http4xx" && !this.isAllowed(e));
  }

  report() {
    return {
      violations: this.violations(),
      observations4xx: this.unexpected4xx(),
      allowedPatterns: this.allowed.map(String),
      all: this.entries,
    };
  }
}
