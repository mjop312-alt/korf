import { describe, expect, it } from "vitest";
import { categoryFor, groupFor, type GroupInput } from "./group";

const p = (title: string, brand: string, ownBrand: boolean, packLabel: string | null, categoryTop: string | null = null): GroupInput => ({
  title,
  brand,
  ownBrand,
  packLabel,
  categoryTop,
});
const key = (i: GroupInput) => groupFor(i).key;

describe("groupFor — zelfde product in verschillende winkels", () => {
  it("huismerken van AH en Jumbo landen in één groep (titel bij Jumbo bevat de grootte)", () => {
    const ah = p("AH Pindakaas naturel", "AH", true, "600 g");
    const jumbo = p("Jumbo Pindakaas Naturel 600 g", "Jumbo", true, "600 g");
    expect(key(ah)).toBe(key(jumbo));
  });

  it("A-merk en huismerk delen een groep zodra ze hetzelfde soort product zijn", () => {
    const campina = p("Campina Halfvolle melk", "Campina", false, "1 l");
    const ah = p("AH Halfvolle melk", "AH", true, "1 l");
    const merkloos = p("Halfvolle Melk 1 L", "Merkloos", false, "1 L");
    expect(key(campina)).toBe(key(ah));
    expect(key(ah)).toBe(key(merkloos));
  });

  it("dezelfde grootte in andere eenheden is dezelfde groep", () => {
    expect(key(p("Jumbo Halfvolle Melk 500ML", "Jumbo", true, "500 ml"))).toBe(
      key(p("AH Halfvolle melk", "AH", true, "0,5 l")),
    );
    expect(key(p("X Melk", "X", false, "0.5 liter"))).toBe(key(p("Y Melk", "Y", false, "500 ml")));
  });

  it("grootte uit de titel als packLabel ontbreekt (Jumbo laat 'm soms leeg)", () => {
    expect(key(p("Jumbo Pindakaas met Stukjes Pinda 350 g", "Jumbo", true, null))).toBe(
      key(p("AH Pindakaas met stukjes pinda", "AH", true, "350 g")),
    );
  });
});

describe("groupFor — echt verschillende producten blijven gescheiden", () => {
  it("andere grootte", () => {
    expect(key(p("AH Halfvolle melk", "AH", true, "1 l"))).not.toBe(key(p("AH Halfvolle melk", "AH", true, "0,5 l")));
  });

  it("een 3-pack is niet hetzelfde als één grote fles met dezelfde inhoud", () => {
    const pack3 = p("AH Halfvolle melk 3-pack", "AH", true, "3 x 200 ml");
    const bottle = p("AH Halfvolle melk", "AH", true, "600 ml");
    expect(key(pack3)).not.toBe(key(bottle));
  });

  it("sub-lijnen (Biologisch, Houdbaar) blijven apart", () => {
    const gewoon = p("AH Halfvolle melk", "AH", true, "1 l");
    expect(key(gewoon)).not.toBe(key(p("AH Biologisch Halfvolle melk", "AH Biologisch", true, "1 l")));
    expect(key(gewoon)).not.toBe(key(p("AH Houdbare halfvolle melk", "AH", true, "1 l")));
  });

  it("smaken en varianten", () => {
    expect(key(p("Coca-Cola Zero sugar", "Coca-Cola", false, "250 ml"))).not.toBe(
      key(p("Coca-Cola Vanilla", "Coca-Cola", false, "250 ml")),
    );
  });

  it("vetpercentages tellen mee", () => {
    expect(key(p("Yoghurt 0% vet", "X", false, "500 g"))).not.toBe(key(p("Yoghurt 3.5% vet", "X", false, "500 g")));
  });
});

describe("groupFor — randgevallen", () => {
  it("titel gelijk aan het merk levert toch een sleutel", () => {
    const g = groupFor(p("COCA-COLA", "Coca-cola", false, null));
    expect(g.key).toMatch(/^coca cola\|x$/);
  });

  it("zonder verpakking (per stuk) krijgt de sleutel 'x'", () => {
    expect(key(p("AH Komkommer", "AH", true, "per stuk"))).toBe("komkommer|x");
  });

  it("'Jumbo's' en accenten worden genegeerd/gevouwen", () => {
    expect(key(p("Jumbo's Hondenkoekjes", "Jumbo's", true, "320 g"))).toBe(key(p("Lidl Hondenkoekjes", "Lidl", true, "320 g")));
    expect(key(p("AH Smeuïge pindakaas", "AH", true, "350 g"))).toBe(key(p("Jumbo Smeuige Pindakaas 350 g", "Jumbo", true, null)));
  });

  it("geeft een stabiele, url-vriendelijke slug", () => {
    const g = groupFor(p("AH Halfvolle melk", "AH", true, "1 l"));
    expect(g.slug).toMatch(/^halfvolle-melk-1l-[0-9a-f]{6}$/);
    expect(groupFor(p("Campina Halfvolle melk", "Campina", false, "1 l")).slug).toBe(g.slug);
  });

  it("leest een nette weergavenaam met grootte", () => {
    expect(groupFor(p("Jumbo Pindakaas Naturel 350 g", "Jumbo", true, "350 g")).name).toBe("Pindakaas naturel 350 g");
    expect(groupFor(p("AH Halfvolle melk 3-pack", "AH", true, "3 x 200 ml")).name).toMatch(/3 × 200 ml$/);
  });

  it("basiseenheid en -grootte", () => {
    const g = groupFor(p("AH Pindakaas", "AH", true, "350 g"));
    expect([g.baseUnit, g.baseSize]).toEqual(["kg", 0.35]);
    expect(groupFor(p("AH Komkommer", "AH", true, "per stuk")).baseUnit).toBe("piece");
  });
});

describe("categoryFor", () => {
  it("mapt winkelcategorieën op één set", () => {
    expect(categoryFor("Zuivel, eieren", "")).toBe("zuivel");
    expect(categoryFor("Zuivel, boter en eieren", "")).toBe("zuivel");
    expect(categoryFor("Groente, aardappelen", "")).toBe("groente-fruit");
    expect(categoryFor("Bier, wijn, aperitieven", "")).toBe("dranken");
    expect(categoryFor("Huishouden", "")).toBe("huishouden");
    expect(categoryFor("Koken, tafelen, vrije tijd", "")).toBe("overig");
  });
  it("gokt op de titel als de winkel geen categorie geeft (Lidl)", () => {
    expect(categoryFor(null, "Diepvries fruit")).toBe("diepvries");
    expect(categoryFor(null, "Kordaat premium pils")).toBe("dranken");
    expect(categoryFor(null, "ROBIJN Quickwash")).toBe("overig");
  });
});
