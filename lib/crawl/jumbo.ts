// Jumbo — volledige catalogus via de (onofficiële) GraphQL-API. Zoeken met een lege term
// mag niet, dus we lopen per hoofdcategorie (`searchType: category`) en pagineren met
// `offSet`. Jumbo geeft EAN, categoriepad en échte begin-/einddata van acties.

import type { CrawledProduct, CrawlOptions, Crawler } from "./types";
import { fetchJson, parseDate, sleep, USER_AGENT } from "./util";

const GRAPHQL_URL = "https://www.jumbo.com/api/graphql";
const DELAY_MS = 200;
const PAGE_STEP = 24; // Jumbo levert pagina's van ~24–26 producten

const HEADERS = {
  "Content-Type": "application/json",
  "apollographql-client-name": "basis-web",
  "apollographql-client-version": "1.0.0",
  "User-Agent": USER_AGENT,
  Origin: "https://www.jumbo.com",
  Referer: "https://www.jumbo.com/",
};

const CATEGORIES_QUERY = `query { categories { id name parentId } }`;
const SEARCH_QUERY = `query S($input: ProductSearchInput!) { searchProducts(input: $input) { count start products {
  id title subtitle brand image link ean
  categories { id name }
  price { price promoPrice pricePerUnit { price unit } }
  availability { availability }
  promotions { id startDate endDate title subtitle tags { text } }
} } }`;

interface JumboPromotion {
  startDate?: string | null;
  endDate?: string | null;
  title?: string | null;
  subtitle?: string | null;
  tags?: { text?: string | null }[] | null;
}
interface JumboProduct {
  id: string;
  title?: string;
  subtitle?: string | null;
  brand?: string | null;
  image?: string | null;
  link?: string | null;
  ean?: string | null;
  categories?: { id: string; name: string }[] | null;
  price?: { price: number; promoPrice: number | null; pricePerUnit?: { price: number } | null } | null;
  availability?: { availability?: string | null } | null;
  promotions?: JumboPromotion[] | null;
}

async function gql<T>(query: string, variables: unknown, label: string): Promise<T> {
  const j = await fetchJson<{ data?: T; errors?: { message: string }[] }>(
    GRAPHQL_URL,
    { method: "POST", headers: HEADERS, body: JSON.stringify({ variables, query }) },
    { label },
  );
  if (j.errors?.length || !j.data) throw new Error(`${label}: ${j.errors?.[0]?.message ?? "geen data"}`);
  return j.data;
}

const OWN_BRAND = /^jumbo/i;
const isSticker = (p: JumboPromotion) =>
  /sticker/i.test([p.title, p.subtitle, ...(p.tags ?? []).map((t) => t.text)].filter(Boolean).join(" "));

function map(p: JumboProduct): CrawledProduct | null {
  const regular = p.price?.price;
  if (!p.title || regular == null || !Number.isFinite(regular)) return null;

  const brand = p.brand?.trim() || "Jumbo";
  const cats = p.categories ?? [];
  const now = Date.now();

  // echte acties: niet-sticker-acties die nog lopen, vroegst eindigende eerst
  const deals = (p.promotions ?? [])
    .filter((pr) => !isSticker(pr) && (pr.tags?.length || pr.title))
    .map((pr) => ({ pr, end: parseDate(pr.endDate) }))
    .filter((d) => !d.end || d.end.getTime() > now)
    .sort((a, b) => (a.end?.getTime() ?? Infinity) - (b.end?.getTime() ?? Infinity));
  const deal = deals[0]?.pr;

  const cut = p.price?.promoPrice != null && p.price.promoPrice < regular;
  let promo: CrawledProduct["promo"] = null;
  if (cut || deal) {
    const tagText = (deal?.tags ?? []).map((t) => t.text).filter(Boolean).join(" · ");
    promo = {
      priceCents: cut ? Math.round(p.price!.promoPrice!) : null,
      label: tagText || deal?.title || "aanbieding",
      startsAt: parseDate(deal?.startDate),
      endsAt: parseDate(deal?.endDate),
    };
  }

  return {
    store: "jumbo",
    externalId: p.id,
    title: p.title,
    brand,
    ownBrand: OWN_BRAND.test(brand),
    categoryTop: cats[0]?.name ?? null,
    categoryPath: cats.length ? cats.map((c) => c.name).join(" > ") : null,
    packLabel: p.subtitle ?? null,
    ean: p.ean ?? null,
    imageUrl: p.image ?? null,
    url: p.link ? `https://www.jumbo.com${p.link}` : null,
    available: !/UNAVAIL|NOT_|OUT/i.test(p.availability?.availability ?? ""),
    priceCents: Math.round(regular),
    unitPriceCents: p.price?.pricePerUnit?.price != null ? Math.round(p.price.pricePerUnit.price) : null,
    promo,
  };
}

/** Hoofdcategorieën: alles onder "SG<n>", plus losse categorieën die daar niet onder hangen. */
async function rootCategories(): Promise<{ id: string; name: string }[]> {
  const { categories } = await gql<{ categories: { id: string; name: string; parentId: string | null }[] }>(
    CATEGORIES_QUERY,
    {},
    "Jumbo categorieën",
  );
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rootOf = (id: string): string => {
    const sg = id.match(/^(SG\d+)/);
    if (sg) return sg[1];
    let cur = id;
    for (let i = 0; i < 10; i++) {
      const parent = byId.get(cur)?.parentId;
      if (!parent) return cur;
      cur = parent;
    }
    return cur;
  };
  const roots = new Map<string, string>();
  for (const c of categories) {
    const r = rootOf(c.id);
    if (!roots.has(r)) roots.set(r, byId.get(r)?.name ?? r);
  }
  return [...roots].map(([id, name]) => ({ id, name }));
}

export const jumboCrawler: Crawler = {
  store: "jumbo",
  async *crawlAll(opts: CrawlOptions = {}) {
    const log = opts.log ?? (() => {});
    const roots = await rootCategories();
    log(`Jumbo: ${roots.length} hoofdcategorieën`);
    const seen = new Set<string>();

    for (const root of roots) {
      let offSet = 0;
      let count = Infinity;
      let inRoot = 0;
      while (offSet < count) {
        const input = {
          searchType: "category",
          searchTerms: root.id,
          friendlyUrl: "",
          offSet,
          currentUrl: "",
          previousUrl: "",
          bloomreachCookieId: "",
        };
        // een losse pagina kan eens falen: drie keer proberen, anders alleen dié pagina
        // overslaan (niet de rest van de categorie laten vallen)
        let res: { searchProducts: { count: number; products: JumboProduct[] } } | null = null;
        let lastError = "";
        for (let attempt = 0; attempt < 3 && !res; attempt++) {
          try {
            res = await gql(SEARCH_QUERY, { input }, `Jumbo ${root.name} @${offSet}`);
          } catch (e) {
            lastError = e instanceof Error ? e.message : String(e);
            await sleep(1500 * (attempt + 1));
          }
        }
        if (!res) {
          if (count === Infinity) {
            log(`Jumbo ${root.id} overgeslagen: ${lastError}`);
            break;
          }
          log(`Jumbo ${root.name} @${offSet}: pagina overgeslagen (${lastError})`);
          offSet += PAGE_STEP;
          continue;
        }
        const { count: total, products } = res.searchProducts;
        count = total;
        if (!products.length) break;

        const batch: CrawledProduct[] = [];
        for (const p of products) {
          const m = map(p);
          if (m && !seen.has(m.externalId)) {
            seen.add(m.externalId);
            batch.push(m);
          }
        }
        inRoot += batch.length;
        if (batch.length) yield batch;
        offSet += products.length;
        await sleep(DELAY_MS);
      }
      log(`Jumbo ${root.name}: ${inRoot} nieuw (totaal ${seen.size})`);
    }
  },
};
