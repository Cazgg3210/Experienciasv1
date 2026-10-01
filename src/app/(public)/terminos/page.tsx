import Link from "next/link";
import { LegalDocument, type LegalSection } from "@/features/marketing/components/legal-document";
import { PageIntro } from "@/features/marketing/components/page-intro";
import { percentFromBps } from "@/features/marketing/domain/display";
import { getSiteSettings } from "@/features/marketing/server/queries";
import { pageMetadata } from "@/features/marketing/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Términos y condiciones",
  description:
    "Condiciones del servicio de experiencias Ivonne & Rosa: cotizaciones, anticipo, saldo, cancelaciones, cambios de fecha, fotos y zonas de servicio.",
  path: "/terminos",
});

function days(n: number) {
  return `${n} ${n === 1 ? "día" : "días"}`;
}

export default async function TermsPage() {
  const { business, pricing, availability } = await getSiteSettings();
  const mail = <a href={`mailto:${business.contactEmail}`}>{business.contactEmail}</a>;

  const sections: LegalSection[] = [
    {
      id: "servicio",
      title: "El servicio",
      content: (
        <>
          <p>
            {business.brandName} diseña y opera experiencias íntimas llave en mano (brunches, celebraciones y experiencias
            temáticas) para grupos de {pricing.minStandardGuests} a {pricing.maxStandardGuests} personas, en el domicilio o
            espacio que nos indiques dentro de nuestras zonas de servicio.
          </p>
          <p>
            Cada experiencia incluye lo descrito en su página y en tu propuesta: comida preparada en sitio, mesa, decoración,
            personal de servicio, montaje y desmontaje. Los add-ons se cotizan por separado. Grupos más grandes se atienden
            como consulta especial.
          </p>
        </>
      ),
    },
    {
      id: "cotizaciones",
      title: "Cotizaciones y vigencia",
      content: (
        <>
          <p>
            Los montos que ves en el sitio y en el configurador son <strong>estimados de referencia</strong>. El precio final
            es el de tu propuesta formal, que considera fecha, número de invitadas, menú, add-ons y zona.
          </p>
          <p>
            Cada propuesta tiene una vigencia de <strong>{days(pricing.quoteValidityDays)}</strong>. Pasado ese plazo, el
            precio y la disponibilidad pueden cambiar. Precios en pesos mexicanos
            {pricing.pricesIncludeTax ? ", IVA incluido" : ", más IVA"}.
          </p>
        </>
      ),
    },
    {
      id: "anticipo",
      title: "Anticipo y reserva",
      content: (
        <p>
          Tu fecha queda reservada cuando se acredita el anticipo del{" "}
          <strong>{percentFromBps(pricing.depositBps)}</strong> del total de la propuesta aceptada. Mientras no se acredite el
          anticipo, la fecha puede ser tomada por otra reserva. Recomendamos reservar con al menos{" "}
          {days(availability.minLeadDays)} de anticipación.
        </p>
      ),
    },
    {
      id: "saldo",
      title: "Saldo",
      content: (
        <p>
          El saldo restante debe liquidarse a más tardar <strong>{days(pricing.balanceDueDaysBefore)}</strong> antes de la
          fecha del evento. Si el saldo no se cubre a tiempo, podremos considerar la reserva como cancelada por la clienta,
          aplicando la política de cancelación.
        </p>
      ),
    },
    {
      id: "cancelacion",
      title: "Cancelaciones",
      content: (
        <>
          <p>{business.cancellationPolicy}</p>
          <p>
            Las cancelaciones deben solicitarse por escrito (WhatsApp o correo a {mail}). Si por causas atribuibles a
            nosotras no pudiéramos realizar tu evento, te reembolsaremos el 100% de lo pagado.
          </p>
        </>
      ),
    },
    {
      id: "cambios",
      title: "Cambios de fecha y de detalles",
      content: (
        <>
          <p>
            Los cambios de fecha están sujetos a disponibilidad y a lo previsto en la política de cancelación. Los cambios en
            número de invitadas, menú o add-ons pueden solicitarse hasta {days(pricing.balanceDueDaysBefore)} antes del
            evento y pueden modificar el total.
          </p>
          <p>
            Algunos add-ons requieren más tiempo de preparación; en ese caso te lo indicaremos al momento de solicitarlos.
          </p>
        </>
      ),
    },
    {
      id: "responsabilidad",
      title: "Responsabilidades",
      content: (
        <>
          <p>Para que todo salga perfecto, te pedimos:</p>
          <ul>
            <li>Un espacio adecuado y seguro para el montaje, con acceso para nuestro equipo y, de preferencia, área techada.</li>
            <li>Informarnos con anticipación de alergias y restricciones alimentarias de tus invitadas.</li>
            <li>Cuidar el mobiliario, vajilla y decoración que llevamos; los daños o faltantes podrán cobrarse a su costo.</li>
          </ul>
          <p>
            Preparamos los alimentos con cuidado, pero nuestra cocina maneja alérgenos comunes, por lo que no podemos
            garantizar la ausencia total de trazas. No somos responsables por retrasos o cancelaciones derivados de caso
            fortuito o fuerza mayor; en esos casos buscaremos contigo una nueva fecha.
          </p>
        </>
      ),
    },
    {
      id: "fotos",
      title: "Fotos y Memory Capsule",
      content: (
        <p>
          La Memory Capsule es un espacio privado para reunir las fotos de tu evento. Quien sube fotos declara contar con el
          consentimiento de las personas que aparecen. Sólo usaremos imágenes de tu evento en nuestro portafolio o redes con
          tu autorización expresa. Puedes pedirnos eliminar fotos en cualquier momento. Consulta nuestro{" "}
          <Link href="/privacidad">aviso de privacidad</Link>.
        </p>
      ),
    },
    {
      id: "zonas",
      title: "Zonas de servicio",
      content: (
        <p>
          Atendemos principalmente Polanco, Granada e Irrigación, en {business.city}. Podemos atender zonas cercanas sujetas a
          disponibilidad y a un cargo de logística, que se indicará en tu propuesta.
        </p>
      ),
    },
    {
      id: "contacto",
      title: "Contacto y legislación aplicable",
      content: (
        <p>
          Para cualquier duda sobre estos términos escríbenos a {mail}. Estos términos se rigen por las leyes de los Estados
          Unidos Mexicanos; cualquier controversia se resolverá ante las autoridades competentes de la Ciudad de México, sin
          perjuicio de los derechos que te otorga la Ley Federal de Protección al Consumidor.
        </p>
      ),
    },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Legal"
        title="Términos y condiciones"
        description="Claridad desde el primer mensaje: así funcionan nuestras propuestas, reservas, pagos y cambios."
        breadcrumbs={[{ href: "/", label: "Inicio" }, { label: "Términos y condiciones" }]}
      />
      <LegalDocument sections={sections} version={business.termsVersion} />
    </>
  );
}
