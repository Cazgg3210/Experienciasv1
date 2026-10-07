import { describe, expect, it } from "vitest";
import { contactUpdateForExisting, unsavedContactNote } from "./contact-merge";

describe("contactUpdateForExisting (clienta que ya existía + captura nueva)", () => {
  const sinCorreo = { email: null, phone: "+525512345678", whatsapp: null };

  it("equipo: completa lo que falta y nunca sobrescribe", () => {
    expect(contactUpdateForExisting("team", sinCorreo, { email: "ana@example.com", phone: "+525512345678" })).toEqual({
      fill: { whatsapp: "+525512345678", email: "ana@example.com" },
      unsaved: {},
    });
    const completa = { email: "ana@example.com", phone: "+525512345678", whatsapp: "+525512345678" };
    expect(contactUpdateForExisting("team", completa, { email: "otra@example.com", phone: "+525599998888" }).fill).toEqual({});
  });

  it("sitio público: nunca agrega correo ni teléfono al perfil; los devuelve para revisión del equipo", () => {
    // Quien conoce el teléfono de una clienta sin correo no puede ponerle su propio correo (le llegarían
    // los enlaces de cotización, portal y pagos).
    expect(contactUpdateForExisting("public", sinCorreo, { email: "intrusa@example.com", phone: "55 1234 5678" })).toEqual({
      fill: {},
      unsaved: { email: "intrusa@example.com" },
    });
    // Ni un teléfono a una clienta encontrada por su correo (avisos por WhatsApp).
    const soloCorreo = { email: "ana@example.com", phone: null, whatsapp: null };
    expect(contactUpdateForExisting("public", soloCorreo, { email: "ana@example.com", phone: "+525511112222" })).toEqual({
      fill: {},
      unsaved: { phone: "+525511112222" },
    });
  });

  it("sitio público: lo que ya coincide con el perfil (en cualquier formato) no se reporta", () => {
    const perfil = { email: "ana@example.com", phone: null, whatsapp: "55 1234 5678" };
    expect(contactUpdateForExisting("public", perfil, { email: "ana@example.com", phone: "+525512345678" })).toEqual({
      fill: {},
      unsaved: {},
    });
  });
});

describe("unsavedContactNote", () => {
  it("nota para el timeline del lead sólo si hay datos distintos", () => {
    expect(unsavedContactNote({})).toBeNull();
    const note = unsavedContactNote({ email: "intrusa@example.com", phone: "+525511112222" });
    expect(note).toContain("correo intrusa@example.com, teléfono +525511112222");
    expect(note).toContain("No se agregaron a su perfil");
  });
});
