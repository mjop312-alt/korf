import { describe, expect, it } from "vitest";
import { lastNumberCents, parseDate, parsePack, weekEnd } from "./util";

describe("parsePack", () => {
  it("rekent naar kg / litre / stuks", () => {
    expect(parsePack("500 g")).toEqual({ size: 0.5, unit: "kg" });
    expect(parsePack("1 kg")).toEqual({ size: 1, unit: "kg" });
    expect(parsePack("1 l")).toEqual({ size: 1, unit: "litre" });
    expect(parsePack("1,5 liter")).toEqual({ size: 1.5, unit: "litre" });
    expect(parsePack("330 ml")).toEqual({ size: 0.33, unit: "litre" });
    expect(parsePack("25 cl")).toEqual({ size: 0.25, unit: "litre" });
    expect(parsePack("12 stuks")).toEqual({ size: 12, unit: "piece" });
  });

  it("vermenigvuldigt multipacks", () => {
    expect(parsePack("6 x 1 L")).toEqual({ size: 6, unit: "litre" });
    expect(parsePack("2 x 500 g")).toEqual({ size: 1, unit: "kg" });
    expect(parsePack("12 x 0,33 l")?.size).toBeCloseTo(3.96);
    expect(parsePack("16 x 5.6 g")?.size).toBeCloseTo(0.0896);
  });

  it("geeft null bij tekst zonder hoeveelheid", () => {
    expect(parsePack("per stuk")).toBeNull();
    expect(parsePack(null)).toBeNull();
    expect(parsePack("")).toBeNull();
  });

  it("verwart 'l' niet met een woord", () => {
    expect(parsePack("Lidl 4 stuks")).toEqual({ size: 4, unit: "piece" });
  });
});

describe("lastNumberCents", () => {
  it("pakt het laatste getal (de prijs, niet de hoeveelheid)", () => {
    expect(lastNumberCents("prijs per kg € 9,62")).toBe(962);
    expect(lastNumberCents("per 100 g € 2.19")).toBe(219);
    expect(lastNumberCents("1 l = 1.29")).toBe(129);
  });
  it("geeft null zonder getal", () => {
    expect(lastNumberCents(null)).toBeNull();
    expect(lastNumberCents("per stuk")).toBeNull();
  });
});

describe("parseDate", () => {
  it("leest Jumbo's tijdzone-suffix", () => {
    const d = parseDate("2026-09-22T23:59:59+02:00[Europe/Amsterdam]");
    expect(d?.toISOString()).toBe("2026-09-22T21:59:59.000Z");
  });
  it("een kale datum wordt begin- of einde-van-de-dag", () => {
    expect(parseDate("2026-09-22")?.getHours()).toBe(0);
    expect(parseDate("2026-09-22", true)?.getHours()).toBe(23);
  });
  it("ongeldig of leeg ⇒ null", () => {
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate("geen datum")).toBeNull();
  });
});

describe("weekEnd", () => {
  it("valt op een zondag om 23:59:59", () => {
    const e = weekEnd(new Date(2026, 8, 16)); // woensdag
    expect(e.getDay()).toBe(0);
    expect([e.getHours(), e.getMinutes(), e.getSeconds()]).toEqual([23, 59, 59]);
    expect(e.getDate()).toBe(20);
  });
  it("zondag zelf blijft diezelfde zondag", () => {
    expect(weekEnd(new Date(2026, 8, 20)).getDate()).toBe(20);
  });
});
