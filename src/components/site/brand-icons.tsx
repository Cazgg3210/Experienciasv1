/**
 * Íconos de redes (lucide ya no incluye marcas). Trazo fino consistente con lucide.
 */
type IconProps = React.SVGProps<SVGSVGElement> & { title?: string };

export function InstagramIcon({ title, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsAppIcon({ title, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d="M3.5 20.5l1.3-4.1A8.5 8.5 0 1 1 8 19.6z" />
      <path d="M9.2 8.6c.2-.5.6-.6.9-.6h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.7l-.5.6c.6 1.2 1.6 2.1 2.8 2.7l.6-.6c.2-.2.5-.2.7-.1l1.6.7c.3.1.4.3.4.6v.4c0 .4-.2.8-.6 1-.6.3-1.5.4-2.6 0-2.1-.8-3.8-2.5-4.7-4.6-.4-1-.3-2 .1-2.6z" />
    </svg>
  );
}
