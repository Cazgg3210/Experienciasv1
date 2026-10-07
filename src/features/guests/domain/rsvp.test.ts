import { describe, expect, it } from "vitest";
import {
  canHostRemoveGuest,
  canSeeFullAddress,
  confirmationCopy,
  findPossibleDuplicates,
  firstName,
  maskEmail,
  normalizeName,
  parseContact,
  duplicateNamesLabel,
  hostDuplicateHint,
  possibleDuplicateIds,
  possibleDuplicateMatches,
  rsvpStats,
  sortDietary,
} from "./rsvp";
import { rsvpFormSchema } from "../schemas";

describe("normalizeName", () => {
  it("ignora acentos, mayúsculas y espacios extra", () => {
    expect(normalizeName("  Sofía   NAVARRO ")).toBe("sofia navarro");
    expect(normalizeName("José-María")).toBe("jose-maria");
    expect(normalizeName("Ana.  Paula!")).toBe("ana paula");
  });
});

describe("firstName", () => {
  it("devuelve el primer nombre", () => {
    expect(firstName("Camila Torres")).toBe("Camila");
    expect(firstName("  ")).toBe("");
    expect(firstName(null)).toBe("");
  });
});

describe("findPossibleDuplicates (sólo para marcar; nunca re-identifica — BUG-003)", () => {
  const guests = [
    { id: "1", name: "Camila Torres", email: null },
    { id: "2", name: "Andrea Solís", email: "andrea@example.com" },
    { id: "3", name: "Ana Paula", email: "ana@example.com" },
  ];

  it("coincide por nombre normalizado (acentos, mayúsculas, espacios)", () => {
    expect(findPossibleDuplicates(guests, { name: "camila  TORRES" }).map((g) => g.id)).toEqual(["1"]);
    expect(findPossibleDuplicates(guests, { name: "Andrea Solis" }).map((g) => g.id)).toEqual(["2"]);
  });

  it("coincide por email aunque el nombre sea otro", () => {
    expect(findPossibleDuplicates(guests, { name: "Otra Persona", email: " ANDREA@example.com " }).map((g) => g.id)).toEqual(["2"]);
  });

  it("marca la coincidencia por nombre aunque la invitada tenga otro email", () => {
    expect(findPossibleDuplicates(guests, { name: "Ana Paula", email: "otra@example.com" }).map((g) => g.id)).toEqual(["3"]);
  });

  it("devuelve todas las coincidencias (nombre de una, email de otra)", () => {
    expect(findPossibleDuplicates(guests, { name: "Camila Torres", email: "ana@example.com" }).map((g) => g.id)).toEqual(["1", "3"]);
  });

  it("sin coincidencias, nombre vacío o email vacío → lista vacía", () => {
    expect(findPossibleDuplicates(guests, { name: "Regina" })).toEqual([]);
    expect(findPossibleDuplicates(guests, { name: "  ", email: "" })).toEqual([]);
    expect(findPossibleDuplicates([{ id: "9", name: "!!", email: null }], { name: "??" })).toEqual([]);
  });
});

describe("possibleDuplicateIds", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 12, minute));

  it("marca los auto-registros que coinciden por nombre o email con otra invitada", () => {
    const flagged = possibleDuplicateIds([
      { id: "host", name: "Camila Ruiz", email: "camila@example.com", source: "HOST", createdAt: at(0) },
      { id: "self-name", name: "camila ruiz", email: null, source: "SELF_RSVP", createdAt: at(5) },
      { id: "self-email", name: "Otra", email: "CAMILA@example.com", source: "SELF_RSVP", createdAt: at(6) },
      { id: "self-unique", name: "Fernanda", email: null, source: "SELF_RSVP", createdAt: at(7) },
    ]);
    expect([...flagged].sort()).toEqual(["self-email", "self-name"]);
  });

  it("las agregadas por anfitriona o equipo nunca se marcan, aunque coincidan", () => {
    const flagged = possibleDuplicateIds([
      { id: "host-a", name: "Paula Mena", email: null, source: "HOST", createdAt: at(0) },
      { id: "admin-b", name: "paula mena", email: null, source: "ADMIN", createdAt: at(1) },
    ]);
    expect(flagged.size).toBe(0);
  });

  it("dos auto-registros que coinciden se marcan los DOS: el orden de llegada no prueba cuál es la original", () => {
    // Alguien se registra con el nombre de una invitada antes que ella: no queda como «la original».
    const flagged = possibleDuplicateIds([
      { id: "b", name: "Lu Díaz", email: null, source: "SELF_RSVP", createdAt: at(9) },
      { id: "a", name: "Lu Diaz", email: null, source: "SELF_RSVP", createdAt: at(1) },
    ]);
    expect([...flagged].sort()).toEqual(["a", "b"]);
  });

  it("un auto-registro se marca también si la coincidencia la agregaron DESPUÉS la anfitriona o el equipo", () => {
    const flagged = possibleDuplicateIds([
      { id: "self-first", name: "Paula Mena", email: null, source: "SELF_RSVP", createdAt: at(0) },
      { id: "admin-later", name: "Paula Mena", email: null, source: "ADMIN", createdAt: at(1) },
      { id: "self-later", name: "Paula Mena", email: null, source: "SELF_RSVP", createdAt: at(2) },
    ]);
    expect([...flagged].sort()).toEqual(["self-first", "self-later"]);
  });

  it("sin coincidencias no marca a nadie", () => {
    expect(possibleDuplicateIds([]).size).toBe(0);
    expect(
      possibleDuplicateIds([
        { id: "a", name: "Ana", email: null, source: "SELF_RSVP", createdAt: at(0) },
        { id: "b", name: "Bea", email: null, source: "SELF_RSVP", createdAt: at(1) },
      ]).size,
    ).toBe(0);
  });
});

describe("possibleDuplicateMatches (con quién coincide cada posible duplicado)", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 12, minute));

  it("devuelve las coincidencias de cada marcada en orden de alta, sin incluirse a sí misma", () => {
    const matches = possibleDuplicateMatches([
      { id: "self-2", name: "Ana Paz", email: null, source: "SELF_RSVP", createdAt: at(5) },
      { id: "host", name: "Ana Paz", email: "ana@example.com", source: "HOST", createdAt: at(0) },
      { id: "self-1", name: "Otra", email: "ANA@example.com", source: "SELF_RSVP", createdAt: at(3) },
    ]);
    expect([...matches.keys()].sort()).toEqual(["self-1", "self-2"]);
    expect(matches.get("self-1")!.map((g) => g.id)).toEqual(["host"]);
    expect(matches.get("self-2")!.map((g) => g.id)).toEqual(["host"]);
    expect(matches.has("host")).toBe(false);
  });
});

describe("textos de posible duplicado", () => {
  it("lista los nombres con comillas latinas", () => {
    expect(duplicateNamesLabel(["Ana"])).toBe("«Ana»");
    expect(duplicateNamesLabel(["Ana", "Bety"])).toBe("«Ana» y «Bety»");
    expect(duplicateNamesLabel(["Ana", "Bety", "Caro"])).toBe("«Ana», «Bety» y «Caro»");
  });

  it("si la coincidencia es una invitada pendiente que agregó la anfitriona, le dice que la quite", () => {
    expect(hostDuplicateHint([{ name: "Ana Paz", removable: true }])).toBe(
      "Coincide con «Ana Paz» de tu lista. Si es la misma persona, quita el registro pendiente de «Ana Paz» para dejar uno solo.",
    );
  });

  it("si no la puede quitar ella, le pide que nos escriba", () => {
    expect(hostDuplicateHint([{ name: "Ana Paz", removable: false }])).toBe(
      "Coincide con «Ana Paz» de tu lista. Si es la misma persona, escríbenos y dejamos un solo registro.",
    );
    expect(hostDuplicateHint([])).toBe("");
  });
});

describe("rsvpStats", () => {
  it("cuenta estados y acompañantes de confirmadas", () => {
    const s = rsvpStats([
      { rsvpStatus: "ATTENDING", plusOne: true },
      { rsvpStatus: "ATTENDING", plusOne: false },
      { rsvpStatus: "NOT_ATTENDING", plusOne: true },
      { rsvpStatus: "MAYBE", plusOne: false },
      { rsvpStatus: "PENDING", plusOne: false },
      { rsvpStatus: "PENDING", plusOne: false },
    ]);
    expect(s).toEqual({ total: 6, attending: 2, notAttending: 1, maybe: 1, pending: 2, plusOnes: 1, headcount: 3 });
  });
});

describe("privacidad y permisos", () => {
  it("sólo quien confirma asistencia ve la dirección completa", () => {
    expect(canSeeFullAddress({ rsvpStatus: "ATTENDING" })).toBe(true);
    expect(canSeeFullAddress({ rsvpStatus: "MAYBE" })).toBe(false);
    expect(canSeeFullAddress({ rsvpStatus: "PENDING" })).toBe(false);
    expect(canSeeFullAddress(null)).toBe(false);
  });

  it("la anfitriona sólo quita invitadas HOST pendientes", () => {
    expect(canHostRemoveGuest({ source: "HOST", rsvpStatus: "PENDING" })).toBe(true);
    expect(canHostRemoveGuest({ source: "HOST", rsvpStatus: "ATTENDING" })).toBe(false);
    expect(canHostRemoveGuest({ source: "SELF_RSVP", rsvpStatus: "PENDING" })).toBe(false);
    expect(canHostRemoveGuest({ source: "ADMIN", rsvpStatus: "PENDING" })).toBe(false);
  });
});

describe("confirmationCopy", () => {
  it("usa el primer nombre y el tono correcto", () => {
    expect(confirmationCopy("ATTENDING", "Camila Torres").title).toBe("¡Gracias, Camila! Te esperamos");
    expect(confirmationCopy("NOT_ATTENDING", "Camila").title).toBe("Te vamos a extrañar");
    expect(confirmationCopy("MAYBE", "Camila").title).toContain("Ojalá");
  });
});

describe("parseContact", () => {
  it("acepta vacío, email o teléfono", () => {
    expect(parseContact("")).toBeNull();
    expect(parseContact("  Ana@Example.com ")).toEqual({ email: "ana@example.com", phone: null });
    expect(parseContact("55 1234 5678")).toEqual({ email: null, phone: "55 1234 5678" });
    expect(parseContact("+52 (55) 1234-5678")).toEqual({ email: null, phone: "+52 (55) 1234-5678" });
  });
  it("rechaza valores inválidos", () => {
    expect(parseContact("ana@")).toHaveProperty("error");
    expect(parseContact("12345")).toHaveProperty("error");
    expect(parseContact("hola mundo")).toHaveProperty("error");
  });
});

describe("sortDietary", () => {
  it("ordena y quita duplicados", () => {
    expect(sortDietary(["VEGAN", "GLUTEN_FREE", "VEGAN", "VEGETARIAN"])).toEqual(["VEGETARIAN", "VEGAN", "GLUTEN_FREE"]);
  });
});

describe("rsvpFormSchema", () => {
  const base = {
    name: "Camila",
    email: "",
    rsvpStatus: "ATTENDING" as const,
    plusOne: false,
    plusOneName: "",
    dietaryRestrictions: [],
    dietaryNotes: "",
    comment: "",
    honoreeMessage: "",
    photoConsent: true,
  };
  it("acepta una respuesta mínima", () => {
    expect(rsvpFormSchema.safeParse(base).success).toBe(true);
  });
  it("exige nombre y respuesta", () => {
    expect(rsvpFormSchema.safeParse({ ...base, name: "A" }).success).toBe(false);
    expect(rsvpFormSchema.safeParse({ ...base, rsvpStatus: "PENDING" }).success).toBe(false);
  });
  it("valida email opcional", () => {
    expect(rsvpFormSchema.safeParse({ ...base, email: "no-es-email" }).success).toBe(false);
    expect(rsvpFormSchema.safeParse({ ...base, email: "camila@example.com" }).success).toBe(true);
  });
  it("pide detalle cuando la restricción es 'Otra'", () => {
    const res = rsvpFormSchema.safeParse({ ...base, dietaryRestrictions: ["OTHER"] });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0]?.path).toEqual(["dietaryNotes"]);
  });
  it("no exige el detalle de 'Otra' si no asistirá (la sección está oculta)", () => {
    const res = rsvpFormSchema.safeParse({ ...base, rsvpStatus: "NOT_ATTENDING", dietaryRestrictions: ["OTHER"] });
    expect(res.success).toBe(true);
  });
});

describe("maskEmail", () => {
  it("oculta el email dejando sólo una pista", () => {
    expect(maskEmail("Camila.Torres@Gmail.com")).toBe("ca•••@gmail.com");
    expect(maskEmail("ab@x.mx")).toBe("a•••@x.mx");
    expect(maskEmail("a@x.mx")).toBe("a•••@x.mx");
    expect(maskEmail("")).toBeNull();
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("camila@gmail.com")).not.toContain("camila");
  });
});
