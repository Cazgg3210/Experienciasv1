import Link from "next/link";
import { LegalDocument, type LegalSection } from "@/features/marketing/components/legal-document";
import { PageIntro } from "@/features/marketing/components/page-intro";
import { getSiteSettings } from "@/features/marketing/server/queries";
import { pageMetadata } from "@/features/marketing/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Aviso de privacidad",
  description:
    "Cómo protegemos tus datos personales y los de tus invitadas: finalidades, datos que recabamos, fotos, derechos ARCO y eliminación de datos.",
  path: "/privacidad",
});

export default async function PrivacyPage() {
  const { business } = await getSiteSettings();
  const email = business.contactEmail;
  const mail = <a href={`mailto:${email}`}>{email}</a>;

  const sections: LegalSection[] = [
    {
      id: "responsable",
      title: "Responsable de tus datos",
      content: (
        <>
          <p>
            <strong>{business.brandName}</strong> (“nosotras”), con operación en {business.city}, es responsable del
            tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
            Particulares (LFPDPPP) y su normativa aplicable.
          </p>
          <p>
            Razón social y domicilio fiscal: <strong>[por confirmar en la versión validada]</strong>. Para cualquier tema de
            privacidad puedes escribirnos a {mail}.
          </p>
        </>
      ),
    },
    {
      id: "datos",
      title: "Datos que recabamos",
      content: (
        <>
          <p>Recabamos únicamente los datos necesarios para diseñar, cotizar y operar tu experiencia:</p>
          <ul>
            <li>
              <strong>Identificación y contacto:</strong> nombre, teléfono o WhatsApp y correo electrónico.
            </li>
            <li>
              <strong>Datos del evento:</strong> fecha, zona y dirección del lugar, número de invitadas, ocasión,
              preferencias de estilo, menú y detalles de personalización.
            </li>
            <li>
              <strong>Datos de invitadas</strong> (cuando usas la lista de invitadas o el micrositio): nombre, medio de
              contacto y confirmación de asistencia.
            </li>
            <li>
              <strong>Alergias y restricciones alimentarias:</strong> pueden considerarse datos sensibles por referirse a la
              salud. Los pedimos <strong>sólo para operar tu evento de forma segura</strong>, con tu consentimiento expreso,
              y los eliminamos o anonimizamos una vez concluido el evento.
            </li>
            <li>
              <strong>Pagos:</strong> los procesa un proveedor de pagos certificado. Nosotras no almacenamos los datos
              completos de tu tarjeta.
            </li>
            <li>
              <strong>Fotografías</strong> que tú o tus invitadas compartan en la Memory Capsule (ver sección 4).
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "finalidades",
      title: "Para qué usamos tus datos",
      content: (
        <>
          <p>
            <strong>Finalidades necesarias</strong> para el servicio que solicitas:
          </p>
          <ul>
            <li>Responder tus solicitudes, confirmar disponibilidad y enviarte cotizaciones.</li>
            <li>Reservar, cobrar anticipo y saldo, y emitir comprobantes.</li>
            <li>Planear y operar tu evento: menú, montaje, logística, personal y atención de alergias.</li>
            <li>Darte acceso a tu portal de evento y al micrositio de invitadas.</li>
            <li>Comunicarnos contigo por WhatsApp, teléfono o correo sobre tu evento.</li>
            <li>Cumplir obligaciones legales, fiscales y contables.</li>
          </ul>
          <p>
            <strong>Finalidades adicionales</strong> (puedes negarte sin afectar el servicio): encuestas de satisfacción,
            invitaciones a nuevas experiencias y promociones. Para negarte, escríbenos a {mail}.
          </p>
        </>
      ),
    },
    {
      id: "fotos",
      title: "Fotografías y consentimiento",
      content: (
        <>
          <p>
            Las fotos que se suben a la Memory Capsule de tu evento se comparten únicamente con quienes tienen el enlace
            privado. Cada persona que sube fotos declara contar con el consentimiento de quienes aparecen en ellas.
          </p>
          <p>
            Sólo usaremos fotografías de tu evento en nuestro portafolio o redes sociales si nos das tu{" "}
            <strong>autorización expresa</strong>, y puedes retirarla en cualquier momento. Evitamos publicar imágenes de
            menores de edad.
          </p>
        </>
      ),
    },
    {
      id: "transferencias",
      title: "Con quién compartimos tus datos",
      content: (
        <>
          <p>
            No vendemos ni rentamos tus datos. Los compartimos sólo con proveedores que nos ayudan a prestar el servicio y
            que los tratan por nuestra cuenta y bajo confidencialidad: procesamiento de pagos, envío de mensajes y correos,
            alojamiento y almacenamiento en la nube, y proveedores del evento (por ejemplo, florería o repostería) cuando es
            indispensable.
          </p>
          <p>
            También podremos comunicarlos cuando lo exija una autoridad competente o en los demás supuestos que la ley
            permite sin requerir tu consentimiento.
          </p>
        </>
      ),
    },
    {
      id: "arco",
      title: "Tus derechos ARCO",
      content: (
        <>
          <p>
            Tienes derecho a <strong>Acceder</strong> a tus datos, <strong>Rectificarlos</strong> si son inexactos,{" "}
            <strong>Cancelarlos</strong> cuando consideres que no se requieren y <strong>Oponerte</strong> a su uso para
            fines específicos. También puedes revocar tu consentimiento o limitar el uso de tus datos.
          </p>
          <p>Envía tu solicitud a {mail} indicando:</p>
          <ul>
            <li>Tu nombre y un medio para responderte.</li>
            <li>Un documento que acredite tu identidad (o la de tu representante).</li>
            <li>La descripción clara de los datos y del derecho que deseas ejercer.</li>
          </ul>
          <p>
            Te responderemos en un plazo máximo de 20 días hábiles y, si procede, haremos efectiva tu solicitud dentro de
            los 15 días hábiles siguientes.
          </p>
        </>
      ),
    },
    {
      id: "eliminacion",
      title: "Conservación y eliminación de datos",
      content: (
        <>
          <p>
            Conservamos tus datos sólo el tiempo necesario para las finalidades descritas y por los plazos que exigen las
            leyes fiscales. Las alergias y restricciones alimentarias se eliminan o anonimizan después del evento.
          </p>
          <p>
            Puedes pedirnos en cualquier momento que eliminemos tus datos, los de tus invitadas o las fotos de tu evento
            escribiéndonos a {mail} o desde nuestra página de <Link href="/contacto">contacto</Link>.
          </p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "Cookies y tecnologías similares",
      content: (
        <p>
          Usamos sólo cookies estrictamente necesarias (por ejemplo, para la sesión segura del equipo) y un identificador
          anónimo guardado en tu navegador para medir, de forma interna y agregada, qué experiencias se visitan. No usamos
          cookies publicitarias ni de rastreo de terceros. Puedes borrar estos datos desde la configuración de tu navegador.
        </p>
      ),
    },
    {
      id: "cambios",
      title: "Cambios a este aviso",
      content: (
        <p>
          Cualquier cambio a este aviso de privacidad se publicará en esta misma página, indicando la versión vigente. Si el
          cambio requiere tu consentimiento, te lo pediremos antes de aplicarlo.
        </p>
      ),
    },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Legal"
        title="Aviso de privacidad"
        description="Tu confianza es parte de la mesa. Aquí te contamos qué datos usamos, para qué y cómo puedes ejercer tus derechos."
        breadcrumbs={[{ href: "/", label: "Inicio" }, { label: "Aviso de privacidad" }]}
      />
      <LegalDocument sections={sections} version={business.termsVersion} />
    </>
  );
}
