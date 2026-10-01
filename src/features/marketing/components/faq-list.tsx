import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { FaqItem } from "../server/queries";

/** Preguntas frecuentes en acordeón (teclado y lectores de pantalla vía Radix). */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <Accordion type="single" collapsible className={cn("border-border/80 border-y", className)}>
      {items.map((faq) => (
        <AccordionItem key={faq.id} value={faq.id} className="border-border/80">
          <AccordionTrigger className="font-heading text-charcoal py-5 text-lg leading-snug font-medium hover:no-underline sm:text-xl">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground max-w-3xl pb-6 text-base leading-relaxed whitespace-pre-line">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
