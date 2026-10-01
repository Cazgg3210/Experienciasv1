import { describe, expect, it } from "vitest";
import {
  canHostRemoveGuest,
  canSeeFullAddress,
  confirmationCopy,
  findMatchingGuest,
  firstName,
  maskEmail,
  normalizeName,
  parseContact,
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

describe("findMatchingGuest", () => {
  const guests = [
    { id: "1", name: "Camila Torres", email: null },
    { id: "2", name: "Andrea Solís", email: "andrea@example.com" },
    { id: "3", name: "Ana Paula", email: "ana@example.com" },
  ];

  it("encuentra por nombre normalizado", () => {
    expect(findMatchingGuest(guests, { name: "camila  TORRES" })?.id).toBe("1");
    expect(findMatchingGuest(guests, { name: "Andrea Solis" })?.id).toBe("2");
  });

  it("prioriza el email cuando se proporciona", () => {
    expect(findMatchingGuest(guests, { name: "Otra Persona", email: "ANDREA@example.com" })?.id).toBe("2");
  });

  it("no empata por nombre si la invitada tiene otro email", () => {
    expect(findMatchingGuest(guests, { name: "Ana Paula", email: "otra@example.com" })).toBeNull();
    // sin email en la invitada sí empata
    expect(findMatchingGuest(guests, { name: "Camila Torres", email: "camila@example.com" })?.id).toBe("1");
  });

  it("devuelve null si no hay coincidencia", () => {
    expect(findMatchingGuest(guests, { name: "Regina" })).toBeNull();
    expect(findMatchingGuest(guests, { name: "  " })).toBeNull();
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
