import { describe, expect, it } from "vitest";
import { matchRecipes } from "./recipes";

describe("matchRecipes", () => {
  it("vindt spaghetti bolognese als bijna alle ingrediënten op de lijst staan", () => {
    const r = matchRecipes(["Spaghetti 500 g", "AH Gehakt half om half", "Tomatenblokjes 400 g", "Ui zak"], 0.6);
    const m = r.find((x) => x.recipe.slug === "spaghetti-bolognese");
    expect(m).toBeTruthy();
    expect(m!.missing.map((i) => i.label)).toEqual(["kaas"]);
    expect(m!.score).toBeCloseTo(4 / 5);
  });

  it("een boodschappenlijst zonder overlap levert niets op", () => {
    const r = matchRecipes(["Halfvolle melk 1 l", "Koffie 500 g", "Pindakaas 350 g"], 0.6);
    expect(r).toEqual([]);
  });

  it("hogere score staat bovenaan, bij gelijke score de minste ontbrekende ingrediënten", () => {
    // tosti: brood + kaas + ham -> alle 3 aanwezig (score 1); omelet: ei + kaas + melk + ui/paprika, alleen ei+kaas (score 0.5, valt onder minScore 0.6)
    const r = matchRecipes(["Bruin brood", "Jong belegen kaas", "Achterham"], 0.6);
    expect(r[0].recipe.slug).toBe("tosti");
    expect(r[0].score).toBe(1);
  });

  it("een productnaam hoeft geen exact woord te zijn — 'tomaten' vindt ook 'tomaat'", () => {
    const r = matchRecipes(["Spaghetti", "Gehakt", "Tomaat", "Ui", "Belegen kaas"], 1);
    expect(r.find((x) => x.recipe.slug === "spaghetti-bolognese")?.score).toBe(1);
  });

  it("minScore filtert gerechten die er net niet aan voldoen", () => {
    const items = ["Spaghetti", "Gehakt"]; // 2 van de 5 ingrediënten
    expect(matchRecipes(items, 0.6)).toEqual([]);
    expect(matchRecipes(items, 0.3).some((m) => m.recipe.slug === "spaghetti-bolognese")).toBe(true);
  });
});
