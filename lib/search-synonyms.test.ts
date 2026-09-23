import { describe, expect, it } from "vitest";
import { expandSearchWords } from "./search-synonyms";

describe("expandSearchWords", () => {
  it("laat een fillerwoord vallen zodat 'wc spul' hetzelfde zoekt als 'wc'", () => {
    expect(expandSearchWords(["wc", "spul"])).toEqual([["wc", "toilet"]]);
  });

  it("geeft synoniemen als extra alternatief, niet als vervanging", () => {
    const r = expandSearchWords(["afwas"]);
    expect(r).toHaveLength(1);
    expect(r[0]).toContain("afwas");
    expect(r[0]).toContain("vaat");
  });

  it("een woord zonder synoniem krijgt alleen zichzelf als alternatief", () => {
    expect(expandSearchWords(["melk"])).toEqual([["melk"]]);
  });

  it("bestaat de hele zoekopdracht uit fillerwoorden, dan blijven ze staan (niets is beter dan alles tonen)", () => {
    expect(expandSearchWords(["spul", "ding"])).toEqual([["spul"], ["ding"]]);
  });

  it("een lege lijst blijft leeg", () => {
    expect(expandSearchWords([])).toEqual([]);
  });
});
