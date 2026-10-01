import { describe, expect, it } from "vitest";
import { matchExperience, rankExperiences, scoreExperience, type RecommendableExperience } from "./recommend";

const exp = (over: Partial<RecommendableExperience> & { id: string }): RecommendableExperience => ({
  name: over.id,
  occasions: [],
  styleIds: [],
  minGuests: 6,
  maxGuests: 12,
  featured: false,
  sortOrder: 0,
  ...over,
});

const signature = exp({
  id: "signature",
  occasions: ["FRIENDS_BRUNCH", "BIRTHDAY"],
  styleIds: ["natural", "romantico"],
  sortOrder: 1,
  featured: true,
});
const birthday = exp({
  id: "birthday",
  occasions: ["BIRTHDAY"],
  styleIds: ["romantico", "divertido"],
  sortOrder: 2,
});
const karaoke = exp({
  id: "karaoke",
  occasions: ["BACHELORETTE", "BIRTHDAY"],
  styleIds: ["divertido"],
  sortOrder: 3,
  maxGuests: 10,
});
const bridal = exp({
  id: "bridal",
  occasions: ["BRIDAL", "BABY_BRUNCH"],
  styleIds: ["elegante", "romantico"],
  sortOrder: 4,
});

describe("matchExperience", () => {
  it("marca null los criterios no especificados y la ocasión 'OTHER'", () => {
    expect(matchExperience(signature, {})).toEqual({ occasion: null, style: null, guests: null });
    expect(matchExperience(signature, { occasion: "OTHER" }).occasion).toBeNull();
  });

  it("evalúa ocasión, estilo e invitadas", () => {
    expect(
      matchExperience(karaoke, { occasion: "BACHELORETTE", styleId: "divertido", guestCount: 11 }),
    ).toEqual({
      occasion: true,
      style: true,
      guests: false,
    });
  });
});

describe("scoreExperience", () => {
  it("pondera ocasión > estilo > invitadas y suma destacado como desempate", () => {
    const c = { occasion: "BIRTHDAY", styleId: "romantico", guestCount: 8 };
    expect(scoreExperience(birthday, c)).toBe(9);
    expect(scoreExperience(signature, c)).toBe(9.5);
    expect(scoreExperience(bridal, c)).toBe(5);
  });
});

describe("rankExperiences", () => {
  it("pone primero las que coinciden en todo, marcadas como recomendadas", () => {
    const ranked = rankExperiences([bridal, karaoke, birthday, signature], {
      occasion: "BIRTHDAY",
      styleId: "romantico",
      guestCount: 8,
    });
    expect(ranked.map((r) => r.experience.id)).toEqual(["signature", "birthday", "karaoke", "bridal"]);
    expect(ranked.filter((r) => r.recommended).map((r) => r.experience.id)).toEqual([
      "signature",
      "birthday",
    ]);
  });

  it("considera el número de invitadas: fuera de rango deja de ser recomendada", () => {
    const ranked = rankExperiences([karaoke, birthday], {
      occasion: "BIRTHDAY",
      styleId: "divertido",
      guestCount: 12,
    });
    expect(ranked[0]!.experience.id).toBe("birthday");
    expect(ranked[0]!.recommended).toBe(true);
    expect(ranked.find((r) => r.experience.id === "karaoke")!.recommended).toBe(false);
  });

  it("si ninguna coincide en todo, recomienda la de mayor puntaje", () => {
    const ranked = rankExperiences([signature, bridal], {
      occasion: "BRIDAL",
      styleId: "divertido",
      guestCount: 30,
    });
    expect(ranked[0]!.experience.id).toBe("bridal");
    expect(ranked[0]!.recommended).toBe(true);
    expect(ranked[1]!.recommended).toBe(false);
  });

  it("sin coincidencias no marca recomendadas y respeta el orden del catálogo", () => {
    const ranked = rankExperiences([bridal, karaoke], {
      occasion: "GATHERING",
      styleId: "minimal",
      guestCount: 30,
    });
    expect(ranked.some((r) => r.recommended)).toBe(false);
    expect(ranked.map((r) => r.experience.id)).toEqual(["karaoke", "bridal"]);
  });

  it("con ocasión 'OTHER' y sin estilo, decide por invitadas", () => {
    const ranked = rankExperiences([karaoke, bridal], { occasion: "OTHER", guestCount: 11 });
    expect(ranked[0]!.experience.id).toBe("bridal");
    expect(ranked[0]!.recommended).toBe(true);
    expect(ranked[1]!.recommended).toBe(false);
  });

  it("no muta la lista original", () => {
    const list = [bridal, signature];
    rankExperiences(list, { occasion: "BIRTHDAY" });
    expect(list.map((e) => e.id)).toEqual(["bridal", "signature"]);
  });
});
