// "Gerechten die ik kan maken met mijn lijstje" — geen AI, geen externe API: een kleine, met de
// hand samengestelde lijst met bekende gerechten en hun ingrediënten, vergeleken met de namen van
// de producten die al op de lijst staan. Een ingrediënt telt als "in huis" zodra een van zijn
// zoekwoorden ergens in de (samengevouwen) productnamen voorkomt.

import { searchTerms } from "./crawl/group";

export interface RecipeIngredient {
  /** Wat er ontbreekt/aanwezig is, zoals getoond aan de gebruiker. */
  label: string;
  /** Zoekwoorden — voldoende als er één voorkomt in een productnaam op de lijst. */
  words: string[];
}

export interface Recipe {
  slug: string;
  name: string;
  emoji: string;
  ingredients: RecipeIngredient[];
}

const ing = (label: string, ...words: string[]): RecipeIngredient => ({ label, words: [label, ...words] });

export const RECIPES: Recipe[] = [
  {
    slug: "spaghetti-bolognese",
    name: "Spaghetti bolognese",
    emoji: "🍝",
    ingredients: [ing("spaghetti"), ing("gehakt"), ing("tomaten", "tomaat", "tomatenblokjes", "tomatensaus", "passata"), ing("ui", "uien"), ing("kaas", "parmezaan")],
  },
  {
    slug: "spaghetti-carbonara",
    name: "Spaghetti carbonara",
    emoji: "🍝",
    ingredients: [ing("spaghetti"), ing("spekjes", "spek", "bacon", "pancetta"), ing("ei", "eieren"), ing("kaas", "parmezaan", "pecorino"), ing("room", "slagroom", "kookroom")],
  },
  {
    slug: "tosti",
    name: "Tosti",
    emoji: "🥪",
    ingredients: [ing("brood", "tosti"), ing("kaas"), ing("ham")],
  },
  {
    slug: "omelet",
    name: "Omelet",
    emoji: "🍳",
    ingredients: [ing("ei", "eieren"), ing("kaas"), ing("melk"), ing("ui of paprika", "ui", "paprika")],
  },
  {
    slug: "tacos",
    name: "Taco's",
    emoji: "🌮",
    ingredients: [ing("taco of tortilla", "taco", "tortilla", "wrap"), ing("gehakt"), ing("tomaat"), ing("sla", "kropsla", "ijsbergsla"), ing("kaas", "cheddar"), ing("ui", "uien")],
  },
  {
    slug: "stamppot-boerenkool",
    name: "Stamppot boerenkool",
    emoji: "🥔",
    ingredients: [ing("boerenkool"), ing("aardappel", "aardappelen", "aardappelpuree"), ing("rookworst")],
  },
  {
    slug: "hutspot",
    name: "Hutspot",
    emoji: "🥕",
    ingredients: [ing("aardappel", "aardappelen"), ing("wortel", "wortelen", "winterpeen"), ing("ui", "uien"), ing("runderlappen", "klapstuk", "sucadelappen")],
  },
  {
    slug: "kip-wraps",
    name: "Kip-wraps",
    emoji: "🌯",
    ingredients: [ing("wrap", "tortilla"), ing("kipfilet", "kip"), ing("sla", "ijsbergsla"), ing("tomaat"), ing("kaas")],
  },
  {
    slug: "nasi-goreng",
    name: "Nasi goreng",
    emoji: "🍚",
    ingredients: [ing("rijst"), ing("ei", "eieren"), ing("kipfilet", "kip"), ing("ketjap"), ing("prei of taugé", "prei", "tauge", "groente")],
  },
  {
    slug: "pannenkoeken",
    name: "Pannenkoeken",
    emoji: "🥞",
    ingredients: [ing("bloem", "pannenkoekenmeel"), ing("melk"), ing("ei", "eieren")],
  },
  {
    slug: "caprese",
    name: "Caprese-salade",
    emoji: "🍅",
    ingredients: [ing("tomaat", "tomaten"), ing("mozzarella"), ing("basilicum")],
  },
  {
    slug: "chili-con-carne",
    name: "Chili con carne",
    emoji: "🌶️",
    ingredients: [ing("gehakt"), ing("kidneybonen", "bonen"), ing("tomaten", "tomatenblokjes"), ing("ui", "uien"), ing("paprika")],
  },
  {
    slug: "macaroni",
    name: "Macaroni",
    emoji: "🧀",
    ingredients: [ing("macaroni"), ing("gehakt"), ing("tomaten", "tomatenblokjes", "tomatensaus"), ing("kaas"), ing("ui", "uien")],
  },
  {
    slug: "lasagne",
    name: "Lasagne",
    emoji: "🍝",
    ingredients: [ing("lasagnebladen", "lasagne"), ing("gehakt"), ing("tomaten", "tomatensaus", "passata"), ing("kaas"), ing("room", "bechamel")],
  },
  {
    slug: "pizza",
    name: "Pizza",
    emoji: "🍕",
    ingredients: [ing("pizzabodem", "pizzadeeg", "pizza"), ing("tomatensaus", "passata"), ing("kaas", "mozzarella"), ing("ham of salami", "ham", "salami", "pepperoni")],
  },
  {
    slug: "hamburgers",
    name: "Hamburgers",
    emoji: "🍔",
    ingredients: [ing("hamburgerbroodjes", "broodje", "hamburgerbrood"), ing("hamburger of gehakt", "hamburger", "gehakt"), ing("kaas"), ing("sla"), ing("tomaat")],
  },
  {
    slug: "vissticks-puree",
    name: "Vissticks met puree",
    emoji: "🐟",
    ingredients: [ing("vissticks"), ing("aardappel", "aardappelpuree", "aardappelen"), ing("groente", "erwten", "wortel")],
  },
  {
    slug: "kip-kerrie",
    name: "Kip-kerrie",
    emoji: "🍛",
    ingredients: [ing("kipfilet", "kip"), ing("kerrie", "currypasta", "kerriepoeder"), ing("kokosmelk"), ing("rijst"), ing("ui", "uien")],
  },
  {
    slug: "groentesoep",
    name: "Groentesoep",
    emoji: "🍲",
    ingredients: [ing("groentesoep", "soep", "bouillon"), ing("groente", "wortel", "prei"), ing("aardappel", "vermicelli")],
  },
  {
    slug: "club-sandwich",
    name: "Club sandwich",
    emoji: "🥪",
    ingredients: [ing("brood", "toast"), ing("kipfilet", "kip"), ing("spek", "bacon"), ing("sla"), ing("tomaat"), ing("ei", "eieren")],
  },
];

export interface RecipeMatch {
  recipe: Recipe;
  have: string[];
  missing: RecipeIngredient[];
  score: number;
}

/** Ergens in de (samengevouwen) productnamen mag het woord voorkomen — geen exacte match nodig. */
function foldName(name: string): string {
  return searchTerms(name).join(" ");
}

/**
 * Gerechten die (grotendeels) te maken zijn met de gegeven productnamen, hoogste score eerst.
 * `minScore` (0–1): welk deel van de ingrediënten minimaal al op de lijst moet staan.
 */
export function matchRecipes(itemNames: string[], minScore = 0.6): RecipeMatch[] {
  const haystack = itemNames.map(foldName).join(" | ");
  const matches = RECIPES.map((recipe) => {
    const have: string[] = [];
    const missing: RecipeIngredient[] = [];
    for (const i of recipe.ingredients) {
      if (i.words.some((w) => haystack.includes(w))) have.push(i.label);
      else missing.push(i);
    }
    return { recipe, have, missing, score: have.length / recipe.ingredients.length };
  });
  return matches
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length || a.recipe.name.localeCompare(b.recipe.name));
}
