import { describe, expect, it } from "vitest";
import { mapAldi, niceBrand } from "./aldi";
import { isPlusOwnBrand, mapPlus } from "./plus";

// 2026-09-22 (middag) — in de looptijd van de actie hieronder
const NOW = new Date("2026-09-22T12:00:00Z");
const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("Aldi", () => {
  const base = {
    objectID: "1243839",
    name: "Protein melk drink",
    brandName: "MILSANI",
    isAvailable: true,
    salesUnit: "1 l",
    productSlug: "protein-melk-drink-1243839",
    currentPrice: { priceValue: 1.49 },
    hierarchicalCategories: { lvl0: ["Zuivel, eieren en boter", "Speciaal assortiment", "ALDI merken"], lvl1: ["Zuivel, eieren en boter > Verse zuivel"] },
  };

  it("herschrijft HOOFDLETTER-merken", () => {
    expect(niceBrand("MILSANI")).toBe("Milsani");
    expect(niceBrand("Coca-Cola")).toBe("Coca-Cola");
    expect(niceBrand("")).toBe("Aldi");
  });

  it("maakt van een Aldi-huismerk een titel zonder merk (zodat het op inhoud matcht)", () => {
    const p = mapAldi(base, NOW)!;
    expect(p.ownBrand).toBe(true);
    expect(p.title).toBe("Protein melk drink");
    expect(p.brand).toBe("Milsani");
    expect(p.priceCents).toBe(149);
    expect(p.unitPriceCents).toBe(149);
    expect(p.categoryTop).toBe("Zuivel, eieren en boter");
    expect(p.promo).toBeNull();
  });

  it("rekent '2 VOOR' om naar een prijs per stuk en negeert acties van volgende week", () => {
    const promo = { validFrom: sec("2026-09-21T00:00:00Z"), validUntil: sec("2026-09-27T21:59:59Z"), priceValue: 2.5, strikePrice: { strikePriceValue: 2.98 }, priceTagLabels: { promoText1: "2 VOOR" } };
    const p = mapAldi({ ...base, promotionPrices: [promo] }, NOW)!;
    expect(p.promo?.priceCents).toBe(125);
    expect(p.promo?.label).toBe("2 VOOR");
    const later = mapAldi({ ...base, promotionPrices: [{ ...promo, validFrom: sec("2026-09-28T00:00:00Z"), validUntil: sec("2026-10-04T00:00:00Z") }] }, NOW)!;
    expect(later.promo).toBeNull();
  });

  it("slaat producten zonder prijs of niet-beschikbare over; een A-merk houdt zijn merk in de titel", () => {
    expect(mapAldi({ ...base, currentPrice: undefined }, NOW)).toBeNull();
    expect(mapAldi({ ...base, isAvailable: false }, NOW)).toBeNull();
    const a = mapAldi({ ...base, name: "Cola 1,5 l", brandName: "COCA-COLA", hierarchicalCategories: { lvl0: ["Speciaal assortiment"], lvl1: ["Speciaal assortiment > A-merken"] } }, NOW)!;
    expect(a.ownBrand).toBe(false);
    expect(a.title).toBe("Coca-Cola Cola 1,5 l");
  });
});

describe("PLUS", () => {
  const base = {
    SKU: "563318",
    Brand: "PLUS Boerentrots",
    Name: "PLUS Boerentrots Kipfilet 2 stuks",
    Product_Subtitle: "Per 350 g",
    Slug: "plus-boerentrots-kipfilet-2-stuks-stuk-350-g-563318",
    OriginalPrice: "5.25",
    NewPrice: "0.0",
    IsAvailable: true,
    Categories: { List: [{ Name: "Vlees, kip, vis, vega" }, { Name: "Kip, kalkoen" }] },
    PromotionLabel: "",
    PromotionStartDate: "1900-01-01",
    PromotionEndDate: "1900-01-01",
  };

  it("herkent huismerken", () => {
    expect(isPlusOwnBrand("PLUS")).toBe(true);
    expect(isPlusOwnBrand("Biologisch PLUS")).toBe(true);
    expect(isPlusOwnBrand("Zuivelmeester")).toBe(true);
    expect(isPlusOwnBrand("Lays")).toBe(false);
  });

  it("mapt prijs, verpakking en categorie", () => {
    const p = mapPlus(base, NOW)!;
    expect(p.priceCents).toBe(525);
    expect(p.packLabel).toBe("350 g");
    expect(p.unitPriceCents).toBe(1500);
    expect(p.categoryPath).toBe("Vlees, kip, vis, vega > Kip, kalkoen");
    expect(p.url).toBe("https://www.plus.nl/product/plus-boerentrots-kipfilet-2-stuks-stuk-350-g-563318");
    expect(p.promo).toBeNull();
  });

  it("haalt het merk uit de titel bij Zuivelmeester (matcht dan op inhoud) maar laat 'PLUS …' staan", () => {
    const z = mapPlus({ ...base, Brand: "Zuivelmeester", Name: "Zuivelmeester Halfvolle melk", Product_Subtitle: "Per 1000 ml" }, NOW)!;
    expect(z.title).toBe("Halfvolle melk");
    expect(z.ownBrand).toBe(true);
    expect(mapPlus(base, NOW)!.title).toBe("PLUS Boerentrots Kipfilet 2 stuks");
  });

  it("onderscheidt actieprijs van alleen-een-label en negeert 1900-datums", () => {
    const withPrice = mapPlus({ ...base, NewPrice: "3.99", PromotionLabel: "Nu voordelig", PromotionEndDate: "2026-09-27" }, NOW)!;
    expect(withPrice.promo?.priceCents).toBe(399);
    expect(withPrice.promo?.endsAt?.getUTCFullYear()).toBe(2026);
    const labelOnly = mapPlus({ ...base, PromotionLabel: "1+1 gratis" }, NOW)!;
    expect(labelOnly.promo?.priceCents).toBeNull();
    expect(labelOnly.promo?.label).toBe("1+1 gratis");
    expect(mapPlus({ ...base, IsAvailable: false }, NOW)).toBeNull();
    expect(mapPlus({ ...base, OriginalPrice: "0" }, NOW)).toBeNull();
  });
});
