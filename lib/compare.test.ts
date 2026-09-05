import { describe, expect, it } from "vitest";
import { availableBrands, brandChoiceOptions, isBrandModeAvailable } from "./catalog";
import { compareList, effectiveCents, formatEuro } from "./compare";
import { CATALOG, SUPERMARKETS } from "./mock-data";
import type { BrandMode, ListItem } from "./types";

const product = (id: string) => CATALOG.find((c) => c.id === id)!;

const ALL = ["ah", "jumbo", "lidl"];
const item = (productId: string, quantity = 1, brandMode: BrandMode = "any"): ListItem => ({
  id: productId,
  productId,
  quantity,
  brandMode,
});
const run = (items: ListItem[], storeIds = ALL, minExtraStoreSavingCents = 0) =>
  compareList(items, CATALOG, SUPERMARKETS, { storeIds, minExtraStoreSavingCents });

describe("compareList — basis", () => {
  it("geeft geen scenario's voor een lege lijst", () => {
    const r = run([]);
    expect(r.cheapestSingle).toBeNull();
    expect(r.balanced).toBeNull();
    expect(r.maxSplit).toBeNull();
  });

  it("geeft alleen scenario A bij één geselecteerde winkel", () => {
    const r = run([item("melk")], ["ah"]);
    expect(r.cheapestSingle).not.toBeNull();
    expect(r.maxSplit).toBeNull();
    expect(r.balanced).toBeNull();
  });

  it("markeert de goedkoopste winkel per regel", () => {
    const r = run([item("melk")]);
    expect(r.rows[0].cheapestStoreId).toBe("lidl");
  });
});

describe("merkvoorkeur", () => {
  it("laat een winkel zonder het vastgezette merk als incompleet gelden", () => {
    // melk erbij zodat Lidl wél iets heeft en de 'mist 1'-waarschuwing zin heeft
    const r = run([item("melk"), item("pindakaas", 1, { brand: "Calvé" })]);
    expect(r.perStoreTotals.lidl.missing).toBe(1);
    expect(r.perStoreTotals.ah.missing).toBe(0);
    expect(r.warnings.some((w) => w.includes("Lidl"))).toBe(true);
  });

  it("kiest bij 'alleen huismerk' de huismerk-variant", () => {
    const r = run([item("koffie", 1, "own")], ["lidl"]);
    expect(r.perStoreTotals.lidl.totalCents).toBe(349); // Bellarom
  });

  it("kiest bij 'maakt niet uit' de goedkoopste passende variant (huismerk < A-merk)", () => {
    const r = run([item("pindakaas")], ["ah"]);
    expect(r.perStoreTotals.ah.totalCents).toBe(175); // AH-huismerk i.p.v. Calvé 329
  });

  it("kiest bij 'altijd A-merk' de goedkoopste A-merk-variant, nooit de huismerk", () => {
    // koffie bij ah: Perla (huismerk) 419 is goedkoper, maar telt niet mee voor a_brand
    const r = run([item("koffie", 1, "a_brand")], ["ah"]);
    expect(r.perStoreTotals.ah.totalCents).toBe(549); // Kanis & Gunnink, niet Perla (419) of Douwe Egberts (649)
  });

  it("'altijd A-merk' telt als ontbrekend als een winkel alleen een huismerk voert", () => {
    // koffie bij lidl: alleen Bellarom (huismerk) — geen A-merk beschikbaar
    const r = run([item("koffie", 1, "a_brand")], ["lidl"]);
    expect(r.perStoreTotals.lidl.missing).toBe(1);
    expect(isBrandModeAvailable("a_brand", product("koffie"), ["lidl"])).toBe(false);
    expect(isBrandModeAvailable("a_brand", product("koffie"), ["ah"])).toBe(true);
  });
});

describe("promoties", () => {
  it("verrekent een kale prijskorting (melk Lidl 99 cent)", () => {
    const r = run([item("melk")], ["lidl"]);
    expect(r.perStoreTotals.lidl.totalCents).toBe(99);
  });

  it("verrekent een 'x voor y'-actie NIET (blijft schapprijs)", () => {
    const r = run([item("chips", 1, { brand: "Lay's" })], ["ah"]);
    expect(r.perStoreTotals.ah.totalCents).toBe(229);
  });

  it("effectiveCents valt terug op de schapprijs als promo.priceCents null is", () => {
    const chips = CATALOG.find((c) => c.id === "chips")!;
    const lays = chips.variants.find((v) => v.store === "ah")!;
    expect(lays.promo?.priceCents).toBeNull();
    expect(effectiveCents(lays)).toBe(229);
  });
});

describe("scenario's", () => {
  const groceries = [
    item("melk", 2),
    item("brood"),
    item("eieren"),
    item("bananen"),
    item("kipfilet"),
    item("koffie"),
  ];

  it("B (max splitsen) is nooit duurder dan A", () => {
    const r = run(groceries);
    expect(r.maxSplit!.totalCents).toBeLessThanOrEqual(r.cheapestSingle!.totalCents);
  });

  it("B is nooit duurder dan C (B mag onbeperkt splitsen)", () => {
    const r = run([...groceries, item("pindakaas"), item("chips")]);
    expect(r.maxSplit!.totalCents).toBeLessThanOrEqual(r.balanced!.totalCents);
  });

  it("C (beste balans) gebruikt hooguit 2 winkels", () => {
    const r = run([...groceries, item("pindakaas", 1, { brand: "Calvé" })]);
    expect(r.balanced!.storeIds.length).toBeLessThanOrEqual(2);
  });

  it("C opent geen tweede winkel voor een verwaarloosbare besparing", () => {
    // hoge drempel: alleen splitsen als het ≥ €50 scheelt → C blijft bij één winkel
    const r = run([item("melk"), item("brood"), item("eieren")], ALL, 5000);
    expect(r.balanced!.storeIds.length).toBe(1);
    expect(r.balanced!.totalCents).toBe(r.cheapestSingle!.totalCents);
  });

  it("besparing is nooit negatief; het aanbevolen scenario is nooit duurder dan A", () => {
    const r = run([item("pindakaas"), item("koffie"), item("chips")]);
    for (const sc of [r.cheapestSingle, r.maxSplit, r.balanced]) {
      if (sc) expect(sc.savingCents).toBeGreaterThanOrEqual(0);
    }
    if (r.recommended === "balanced" && r.cheapestSingle) {
      expect(r.balanced!.totalCents).toBeLessThanOrEqual(r.cheapestSingle.totalCents);
    }
  });

  it("beveelt 'balanced' aan wanneer splitsen over 2 winkels echt goedkoper is", () => {
    const r = run(
      [
        item("pindakaas", 1, { brand: "Calvé" }), // forceert AH/Jumbo → Lidl incompleet
        item("koffie"),
        item("chips"),
        item("wasmiddel"),
        item("jus"),
        item("roomboter"),
        item("melk", 2),
      ],
      ALL,
      200, // standaard-drempel van €2
    );
    expect(r.recommended).toBe("balanced");
    expect(r.balanced!.totalCents).toBeLessThan(r.cheapestSingle!.totalCents);
    expect(r.balanced!.storeIds.length).toBe(2);
  });
});

describe("merken zijn winkel-afhankelijk", () => {
  it("toont geen merk dat alleen bij een niet-geselecteerde winkel bestaat", () => {
    const koffie = product("koffie");
    const { brands } = availableBrands(koffie, ["ah", "jumbo"]);
    expect(brands).not.toContain("Bellarom"); // Lidl-huismerk
    expect(brands).toEqual(expect.arrayContaining(["Douwe Egberts", "Perla"]));
  });

  it("laat het Lidl-huismerk vallen zodra Lidl niet meer meedoet", () => {
    const melk = product("melk");
    expect(availableBrands(melk, ["ah", "jumbo", "lidl"]).brands).toContain("Milbona");
    expect(availableBrands(melk, ["ah", "jumbo"]).brands).not.toContain("Milbona");
  });

  it("brandChoiceOptions bevat 'maakt niet uit' en alleen bereikbare merken", () => {
    const opts = brandChoiceOptions(product("chips"), ["jumbo"]);
    const values = opts.map((o) => o.value);
    expect(values[0]).toBe("any");
    expect(values).toContain("brand:Lay's");
    expect(values).toContain("own"); // Jumbo-huismerk chips bestaat
    expect(values).not.toContain("brand:Snack Day"); // Lidl
  });

  it("'alleen huismerk' verdwijnt als geen enkele gekozen winkel een huismerk voert", () => {
    // pindakaas: huismerk alleen bij AH en Jumbo, niet bij Lidl
    expect(brandChoiceOptions(product("pindakaas"), ["lidl"]).some((o) => o.value === "own")).toBe(false);
    expect(brandChoiceOptions(product("pindakaas"), ["ah"]).some((o) => o.value === "own")).toBe(true);
  });

  it("isBrandModeAvailable ontdekt een merkkeuze die niet meer kan", () => {
    const koffie = product("koffie");
    expect(isBrandModeAvailable({ brand: "Bellarom" }, koffie, ["ah", "jumbo"])).toBe(false);
    expect(isBrandModeAvailable({ brand: "Douwe Egberts" }, koffie, ["ah", "jumbo"])).toBe(true);
    expect(isBrandModeAvailable("any", koffie, ["ah"])).toBe(true);
  });
});

describe("formatEuro", () => {
  it("formatteert centen als NL-euro", () => {
    // Intl scheidt symbool en bedrag met een harde spatie (U+00A0); normaliseer die weg.
    expect(formatEuro(4115).replace(/\s/g, " ")).toBe("€ 41,15");
  });
});
