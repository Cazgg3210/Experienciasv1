// @vitest-environment node
import { describe, expect, it } from "vitest";
import { paintedIdToAdopt } from "./use-painted-id";

// Ids con la forma de `useId` en React 19.2 al pintar en el servidor y al hidratar (`_R_…_`); más abajo, uno explícito.
const SERVER = "_R_1b6atb_";
const CLIENT = "_R_2kd9_";

describe("paintedIdToAdopt (parte pura de usePaintedId)", () => {
  it("sin atributo pintado no adopta nada", () => {
    expect(paintedIdToAdopt(null, "", CLIENT)).toBeNull();
    expect(paintedIdToAdopt(undefined, "-desc", CLIENT)).toBeNull();
    expect(paintedIdToAdopt("", "", CLIENT)).toBeNull();
  });

  it("con un sufijo que no coincide no adopta nada", () => {
    expect(paintedIdToAdopt(`${SERVER}-hint`, "-desc", CLIENT)).toBeNull();
    expect(paintedIdToAdopt(SERVER, "-d", CLIENT)).toBeNull();
  });

  it("si el id pintado es igual al generado no hay nada que adoptar", () => {
    expect(paintedIdToAdopt(CLIENT, "", CLIENT)).toBeNull();
    expect(paintedIdToAdopt(`${CLIENT}-desc`, "-desc", CLIENT)).toBeNull();
    expect(paintedIdToAdopt("nombre-clienta", "", "nombre-clienta")).toBeNull();
  });

  it("si el id pintado difiere del generado, devuelve el del servidor", () => {
    expect(paintedIdToAdopt(SERVER, "", CLIENT)).toBe(SERVER);
  });

  it.each([
    ["-d", `${SERVER}-d`],
    ["-desc", `${SERVER}-desc`],
    ["-hint", `${SERVER}-hint`],
  ])("con el sufijo %s quita el sufijo y adopta el id del servidor", (suffix, painted) => {
    expect(paintedIdToAdopt(painted, suffix, CLIENT)).toBe(SERVER);
  });

  it("el sufijo se quita sólo del final", () => {
    expect(paintedIdToAdopt("campo-d-d", "-d", CLIENT)).toBe("campo-d");
    expect(paintedIdToAdopt("_R_-desc_-desc", "-desc", CLIENT)).toBe("_R_-desc_");
  });

  it("si el atributo es sólo el sufijo (sin id antes) no adopta nada", () => {
    expect(paintedIdToAdopt("-desc", "-desc", CLIENT)).toBeNull();
    expect(paintedIdToAdopt("-hint", "-hint", CLIENT)).toBeNull();
  });
});
