import { describe, expect, it } from "vitest";
import {
  EMPTY_LEAD_FILTERS,
  activeFilterCount,
  buildLeadOrderBy,
  buildLeadWhere,
  hasAnyFilter,
  leadFiltersToSearchParams,
  parseLeadFilters,
  toggleStatus,
} from "./lead-filters";

describe("parseLeadFilters", () => {
  it("devuelve valores por defecto con searchParams vacíos", () => {
    expect(parseLeadFilters({})).toEqual(EMPTY_LEAD_FILTERS);
  });

  it("acepta estados repetidos y separados por coma, ignorando inválidos y duplicados", () => {
    const f = parseLeadFilters({ status: ["NEW", "contacted,LOST", "HACKED", "NEW"] });
    expect(f.statuses).toEqual(["NEW", "CONTACTED", "LOST"]);
  });

  it("valida origen, orden, banderas y asignación", () => {
    const f = parseLeadFilters({
      source: "whatsapp",
      sort: "event_asc",
      flag: ["outOfArea", "special", "nope"],
      assignedTo: "none",
    });
    expect(f.source).toBe("WHATSAPP");
    expect(f.sort).toBe("event_asc");
    expect(f.flags).toEqual(["outOfArea", "special"]);
    expect(f.assignedTo).toBe("none");

    const bad = parseLeadFilters({ source: "FAX", sort: "random", assignedTo: "x'; DROP TABLE" });
    expect(bad.source).toBeNull();
    expect(bad.sort).toBe("created_desc");
    expect(bad.assignedTo).toBeNull();
  });

  it("descarta fechas inválidas y ordena el rango", () => {
    expect(parseLeadFilters({ from: "2026-02-30", to: "nope" })).toMatchObject({ from: null, to: null });
    expect(parseLeadFilters({ from: "2026-12-01", to: "2026-11-01" })).toMatchObject({
      from: "2026-11-01",
      to: "2026-12-01",
    });
  });

  it("recorta la búsqueda", () => {
    const f = parseLeadFilters({ q: `  ${"a".repeat(150)}  ` });
    expect(f.q).toHaveLength(100);
    expect(parseLeadFilters({ q: "   " }).q).toBeNull();
  });
});

describe("serialización de filtros", () => {
  it("es reversible (round trip)", () => {
    const f = parseLeadFilters({
      status: ["NEW", "QUOTED"],
      source: "INSTAGRAM",
      q: "sofía",
      from: "2026-10-01",
      to: "2026-10-31",
      dateField: "created",
      flag: "special",
      sort: "event_desc",
      assignedTo: "user_123",
    });
    const params = leadFiltersToSearchParams(f, { view: "kanban" });
    expect(params.get("view")).toBe("kanban");
    const back = parseLeadFilters(Object.fromEntries([...new Set(params.keys())].map((k) => [k, params.getAll(k)])));
    expect(back).toEqual(f);
  });

  it("omite valores por defecto", () => {
    expect(leadFiltersToSearchParams(EMPTY_LEAD_FILTERS).toString()).toBe("");
  });

  it("toggleStatus agrega y quita", () => {
    const a = toggleStatus(EMPTY_LEAD_FILTERS, "NEW");
    expect(a.statuses).toEqual(["NEW"]);
    expect(toggleStatus(a, "NEW").statuses).toEqual([]);
  });

  it("cuenta filtros activos", () => {
    expect(activeFilterCount(EMPTY_LEAD_FILTERS)).toBe(0);
    expect(hasAnyFilter({ ...EMPTY_LEAD_FILTERS, q: "x" })).toBe(true);
    expect(
      activeFilterCount({ ...EMPTY_LEAD_FILTERS, statuses: ["NEW", "LOST"], flags: ["outOfArea", "special"], from: "2026-01-01" }),
    ).toBe(4);
  });
});

describe("buildLeadWhere", () => {
  it("sin filtros no restringe", () => {
    expect(buildLeadWhere(EMPTY_LEAD_FILTERS)).toEqual({});
  });

  it("combina estado, origen, banderas y sin asignar", () => {
    const where = buildLeadWhere({
      ...EMPTY_LEAD_FILTERS,
      statuses: ["NEW"],
      source: "REFERRAL",
      flags: ["outOfArea", "special"],
      assignedTo: "none",
    });
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { status: { in: ["NEW"] } },
        { source: "REFERRAL" },
        { assignedToId: null },
        { outOfArea: true },
        { specialRequest: true },
      ]),
    );
  });

  it("ignoreStatus omite el estado (conteos del resumen)", () => {
    const where = buildLeadWhere({ ...EMPTY_LEAD_FILTERS, statuses: ["WON"] }, { ignoreStatus: true });
    expect(where).toEqual({});
  });

  it("rango por fecha del evento usa columnas @db.Date (medianoche UTC)", () => {
    const where = buildLeadWhere({ ...EMPTY_LEAD_FILTERS, from: "2026-10-01", to: "2026-10-31" });
    expect(where.AND).toEqual([
      { eventDate: { gte: new Date("2026-10-01T00:00:00.000Z"), lte: new Date("2026-10-31T00:00:00.000Z") } },
    ]);
  });

  it("rango por fecha de registro usa el día local de CDMX", () => {
    const where = buildLeadWhere({ ...EMPTY_LEAD_FILTERS, dateField: "created", from: "2026-10-01", to: "2026-10-01" });
    // CDMX = UTC-6 todo el año
    expect(where.AND).toEqual([
      { createdAt: { gte: new Date("2026-10-01T06:00:00.000Z"), lt: new Date("2026-10-02T06:00:00.000Z") } },
    ]);
  });

  it("la búsqueda incluye nombre, email, código y teléfono (también sólo dígitos)", () => {
    const where = buildLeadWhere({ ...EMPTY_LEAD_FILTERS, q: "55 5102" });
    const or = (where.AND as Array<{ OR?: unknown[] }>)[0]!.OR!;
    expect(or).toEqual(
      expect.arrayContaining([
        { name: { contains: "55 5102", mode: "insensitive" } },
        { code: { contains: "55 5102", mode: "insensitive" } },
        { phone: { contains: "555102" } },
      ]),
    );
  });
});

describe("buildLeadOrderBy", () => {
  it("por defecto más recientes primero; por evento con nulos al final", () => {
    expect(buildLeadOrderBy("created_desc")[0]).toEqual({ createdAt: "desc" });
    expect(buildLeadOrderBy("event_asc")[0]).toEqual({ eventDate: { sort: "asc", nulls: "last" } });
  });
});
