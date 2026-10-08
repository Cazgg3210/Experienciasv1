import { describe, expect, it } from "vitest";
import {
  GENERAL_INVITE_FULL_MESSAGE,
  HOST_REMOVE_GUEST_DESCRIPTION,
  MAX_GUESTS_PER_EVENT,
  SELF_RSVP_MARGIN_BPS,
  SELF_RSVP_MIN_MARGIN,
  canHostRemoveGuest,
  canSeeFullAddress,
  canSelfRegister,
  confirmationCopy,
  findPossibleDuplicates,
  firstName,
  maskEmail,
  normalizeName,
  parseContact,
  duplicateNamesLabel,
  hostDuplicateHint,
  hostInvitationFullNotice,
  hostRemoveGuestDescription,
  possibleDuplicateIds,
  possibleDuplicateMatches,
  rsvpStats,
  selfRsvpGuestLimit,
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

  // Revisión de BUG-003: el registro que agregó la anfitriona (o el equipo) es el confiable; el aviso nunca le
  // pide quitarlo. Primero que lo confirme con su invitada y, si el auto-registro no es suyo, lo quitamos nosotras.
  // Si sí es suyo, que responda desde su link personal Y nos escriba para dejar un solo registro, el confiable
  // (revisión adversarial de #7: sólo con responder desde su link el auto-registro seguía en la lista).
  it("si coincide con una invitada que agregó la anfitriona: confirmarlo con ella, quitar el auto-registro y nunca el suyo", () => {
    const hint = hostDuplicateHint([{ name: "Ana Paz", source: "HOST" }]);
    expect(hint).toBe(
      "Coincide con «Ana Paz» de tu lista. Primero confírmalo con ella: si este registro no es suyo, escríbenos y lo quitamos; si sí es suyo, pídele que responda desde su link personal y escríbenos para dejar un solo registro: el que agregaste tú. No quites el registro de «Ana Paz».",
    );
    expect(hint).not.toMatch(/quita (el|los) registros? (pendientes? )?de/);
  });

  it("si sí es suyo, pide escribirnos para dejar un solo registro (el confiable), no sólo que responda desde su link", () => {
    const hint = hostDuplicateHint([{ name: "Ana Paz", source: "HOST" }]);
    const yes = hint.slice(hint.indexOf("si sí es suyo"), hint.indexOf(" No quites"));
    expect(yes).toBe(
      "si sí es suyo, pídele que responda desde su link personal y escríbenos para dejar un solo registro: el que agregaste tú.",
    );
  });

  it("el registro que agregó el equipo también se conserva (aunque ya haya respondido)", () => {
    expect(hostDuplicateHint([{ name: "Ana Paz", source: "ADMIN" }])).toBe(
      "Coincide con «Ana Paz» de tu lista. Primero confírmalo con ella: si este registro no es suyo, escríbenos y lo quitamos; si sí es suyo, pídele que responda desde su link personal y escríbenos para dejar un solo registro: el que agregó el equipo. No quites el registro de «Ana Paz».",
    );
  });

  it("con varias coincidencias habla en plural y sólo pide conservar las confiables", () => {
    expect(
      hostDuplicateHint([
        { name: "Ana Paz", source: "HOST" },
        { name: "Bety Paz", source: "SELF_RSVP" },
      ]),
    ).toBe(
      "Coincide con «Ana Paz» y «Bety Paz» de tu lista. Primero confírmalo con ellas: si este registro no es de ninguna, escríbenos y lo quitamos; si es de alguna, pídele que responda desde su link personal y escríbenos para dejar un solo registro: el que agregaste tú. No quites el registro de «Ana Paz».",
    );
    const mixed = hostDuplicateHint([
      { name: "Ana Paz", source: "HOST" },
      { name: "Bety Paz", source: "ADMIN" },
    ]);
    expect(mixed).toContain("escríbenos para dejar un solo registro: el que agregaste tú o el equipo.");
    expect(mixed).toContain("No quites los registros de «Ana Paz» y «Bety Paz».");
  });

  it("si sólo coincide con otros auto-registros (nadie es el confiable), confirmarlo y escribirnos", () => {
    expect(hostDuplicateHint([{ name: "Ana Paz", source: "SELF_RSVP" }])).toBe(
      "Coincide con «Ana Paz» de tu lista. Primero confírmalo con ella y, si es la misma persona, escríbenos y dejamos un solo registro.",
    );
    expect(
      hostDuplicateHint([
        { name: "Ana Paz", source: "SELF_RSVP" },
        { name: "Ana P.", source: "SELF_RSVP" },
      ]),
    ).toBe(
      "Coincide con «Ana Paz» y «Ana P.» de tu lista. Primero confírmalo con ellas y, si es la misma persona, escríbenos y dejamos un solo registro.",
    );
    expect(hostDuplicateHint([])).toBe("");
  });
});

describe("tope de auto-registros del link general (guestCount + margen, techo 60)", () => {
  it("las constantes son explícitas: 50 % de margen, mínimo 5 y techo de 60", () => {
    expect(SELF_RSVP_MARGIN_BPS).toBe(5_000);
    expect(SELF_RSVP_MIN_MARGIN).toBe(5);
    expect(MAX_GUESTS_PER_EVENT).toBe(60);
  });

  it("evento chico: el margen mínimo de 5 manda", () => {
    expect(selfRsvpGuestLimit(1)).toBe(6);
    expect(selfRsvpGuestLimit(4)).toBe(9);
    expect(selfRsvpGuestLimit(6)).toBe(11);
    expect(selfRsvpGuestLimit(10)).toBe(15); // 50 % de 10 = 5 = mínimo
  });

  it("evento mediano y grande: 50 % de margen, redondeado hacia arriba", () => {
    expect(selfRsvpGuestLimit(11)).toBe(17); // 11 + ⌈5.5⌉
    expect(selfRsvpGuestLimit(12)).toBe(18);
    expect(selfRsvpGuestLimit(20)).toBe(30);
    expect(selfRsvpGuestLimit(39)).toBe(59);
  });

  it("nunca pasa del techo absoluto de 60", () => {
    expect(selfRsvpGuestLimit(40)).toBe(60);
    expect(selfRsvpGuestLimit(41)).toBe(60);
    expect(selfRsvpGuestLimit(60)).toBe(60);
    expect(selfRsvpGuestLimit(200)).toBe(60);
  });

  it("guestCount inválido (0, negativo, decimal o NaN) no abre la lista: queda en el margen mínimo", () => {
    expect(selfRsvpGuestLimit(0)).toBe(5);
    expect(selfRsvpGuestLimit(-3)).toBe(5);
    expect(selfRsvpGuestLimit(Number.NaN)).toBe(5);
    expect(selfRsvpGuestLimit(10.9)).toBe(15);
  });

  it("justo debajo del tope admite una más; en el borde y arriba ya no", () => {
    // guestCount 10 → tope 15
    expect(canSelfRegister(0, 10)).toBe(true);
    expect(canSelfRegister(14, 10)).toBe(true);
    expect(canSelfRegister(15, 10)).toBe(false);
    expect(canSelfRegister(16, 10)).toBe(false);
    // guestCount grande → techo 60
    expect(canSelfRegister(59, 80)).toBe(true);
    expect(canSelfRegister(60, 80)).toBe(false);
    expect(canSelfRegister(61, 80)).toBe(false);
  });

  it("el mensaje del tope es cálido, dice qué hacer y no revela cuántas ni quiénes", () => {
    expect(GENERAL_INVITE_FULL_MESSAGE).toContain("Pídele a la anfitriona tu link personal");
    expect(GENERAL_INVITE_FULL_MESSAGE).not.toMatch(/\d/);
  });
});

describe("aviso del portal con la invitación general en su tope (hostInvitationFullNotice)", () => {
  it("mientras el link general recibe respuestas no hay aviso (mismo criterio que canSelfRegister)", () => {
    expect(hostInvitationFullNotice(0, 6)).toBeNull();
    expect(hostInvitationFullNotice(10, 6)).toBeNull(); // tope 11
    expect(hostInvitationFullNotice(59, 100)).toBeNull(); // techo 60
  });

  it("en el tope: agregarla y mandarle su link personal, y escribirnos si ve registros que no reconoce", () => {
    const expected =
      "Tu invitación general ya no recibe más respuestas: llegó al tope de registros para tu experiencia. Si alguien más quiere confirmar, agrégala a tu lista y mándale su link personal. Si ves registros que no reconoces, escríbenos y los quitamos para liberar lugares.";
    expect(hostInvitationFullNotice(11, 6)).toBe(expected);
    expect(hostInvitationFullNotice(13, 6)).toBe(expected); // la anfitriona pasó del tope: sigue pudiendo agregar
    expect(hostInvitationFullNotice(59, 39)).toBe(expected); // tope 59, abajo del techo
  });

  it("con la lista en el techo de 60 ya no le pide agregarla (tampoco podría): que nos escriba", () => {
    const notice = hostInvitationFullNotice(MAX_GUESTS_PER_EVENT, 100);
    expect(notice).toBe(
      "Tu invitación general ya no recibe más respuestas y tu lista llegó al máximo de 60 invitadas. Si alguien más quiere venir, escríbenos y lo vemos juntas. Si ves registros que no reconoces, escríbenos y los quitamos para liberar lugares.",
    );
    expect(notice).not.toContain("agrégala a tu lista");
    expect(hostInvitationFullNotice(60, 6)).toBe(notice);
  });
});

describe("diálogo «¿Quitar a …?» del portal (hostRemoveGuestDescription)", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 12, minute));
  const describeFor = (id: string, guests: Array<{ id: string; name: string; email: string | null; source: "HOST" | "ADMIN" | "SELF_RSVP"; createdAt: Date }>) =>
    hostRemoveGuestDescription(guests.find((g) => g.id === id)!, guests, possibleDuplicateMatches(guests));

  it("sin posible duplicado ni homónimas: el texto de siempre (puede volver a agregarla)", () => {
    expect(
      describeFor("host", [
        { id: "host", name: "Ana Paz", email: null, source: "HOST", createdAt: at(0) },
        { id: "self", name: "Fernanda", email: null, source: "SELF_RSVP", createdAt: at(1) },
      ]),
    ).toBe(HOST_REMOVE_GUEST_DESCRIPTION);
    expect(HOST_REMOVE_GUEST_DESCRIPTION).toBe("Su link personal dejará de funcionar. Puedes volver a agregarla cuando quieras.");
  });

  it("con un auto-registro marcado que coincide con ella: su registro es el confiable y le pide escribirnos", () => {
    const text = describeFor("host", [
      { id: "host", name: "Ana Paz", email: "ana@example.com", source: "HOST", createdAt: at(0) },
      { id: "self", name: "ana paz", email: null, source: "SELF_RSVP", createdAt: at(1) },
    ]);
    expect(text).toBe(
      "Su link personal dejará de funcionar. Ojo: un registro de la invitación general coincide con ella, y el confiable es este, el que agregaste tú. Si es la misma persona, no la quites: escríbenos y dejamos un solo registro.",
    );
    // Con el auto-registro del mismo nombre, addGuestAsHost la rechazaría: no se promete volver a agregarla
    expect(text).not.toContain("Puedes volver a agregarla");
  });

  it("también si la coincidencia es por email, y cuenta varios auto-registros", () => {
    const text = describeFor("host", [
      { id: "host", name: "Ana Paz", email: "ana@example.com", source: "HOST", createdAt: at(0) },
      { id: "s1", name: "Otra", email: "ANA@example.com", source: "SELF_RSVP", createdAt: at(1) },
      { id: "s2", name: "Ana  PAZ", email: null, source: "SELF_RSVP", createdAt: at(2) },
    ]);
    expect(text).toContain("Ojo: 2 registros de la invitación general coinciden con ella, y el confiable es este");
    expect(text).not.toContain("Puedes volver a agregarla");
  });

  it("con una homónima que no es posible duplicado (agregada por el equipo) no promete volver a agregarla", () => {
    const text = describeFor("host", [
      { id: "host", name: "Ana Paz", email: null, source: "HOST", createdAt: at(0) },
      { id: "admin", name: "ANA PAZ", email: null, source: "ADMIN", createdAt: at(1) },
    ]);
    expect(text).toBe(
      "Su link personal dejará de funcionar. Como ya hay otra invitada con su nombre en tu lista, no podrás volver a agregarla con ese nombre.",
    );
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
