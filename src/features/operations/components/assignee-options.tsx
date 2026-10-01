export type AssigneeOption = { id: string; name: string; assigned?: boolean };

/**
 * <option>s de responsable agrupadas: primero quienes están asignadas al evento (sólo ellas ven
 * el evento en su portal) y después el resto del equipo.
 */
export function AssigneeOptions({ options }: { options: AssigneeOption[] }) {
  const onEvent = options.filter((o) => o.assigned);
  const rest = options.filter((o) => !o.assigned);
  const render = (list: AssigneeOption[]) =>
    list.map((s) => (
      <option key={s.id} value={s.id}>
        {s.name}
      </option>
    ));
  if (!onEvent.length) return <>{render(rest)}</>;
  return (
    <>
      <optgroup label="Asignadas a este evento">{render(onEvent)}</optgroup>
      {rest.length ? <optgroup label="Resto del equipo (aún no ven este evento)">{render(rest)}</optgroup> : null}
    </>
  );
}
