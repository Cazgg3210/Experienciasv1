import { serializeJsonLd, type JsonLd as JsonLdData } from "../domain/json-ld";

/** Inserta datos estructurados schema.org (escapados contra XSS). */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
