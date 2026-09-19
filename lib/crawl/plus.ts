// PLUS — plus.nl is een OutSystems-webapp. Dezelfde "screen data action" die de productlijst in
// de browser vult (`PLP_Content/DataActionGetProductListAndCategoryInfo`) geeft, met een
// anonieme sessie-cookie, 12 producten per pagina voor het hele assortiment (~17.500).
// `PageNumber` pagineert, `CategorySlug` beperkt tot één categorie. Geen EAN in de lijst.
//
// Versies (`moduleVersion` en `apiVersion`) veranderen bij een release van PLUS; we lezen ze
// aan het begin van elke ronde opnieuw uit hun eigen scripts.

import type { CrawledProduct, CrawlOptions, Crawler } from "./types";
import { parseDate, parsePack, sleep, USER_AGENT, weekEnd } from "./util";

const BASE = "https://www.plus.nl";
const ACTION = "screenservices/ECP_Composition_CW/ProductLists/PLP_Content/DataActionGetProductListAndCategoryInfo";
const FALLBACK_API_VERSION = "cafT+CKg7ockKx+9Kx_BsQ";
const DELAY_MS = 120;

export interface PlusItem {
  SKU?: string;
  Brand?: string;
  Name?: string;
  Product_Subtitle?: string;
  Slug?: string;
  ImageURL?: string;
  OriginalPrice?: string;
  NewPrice?: string;
  EAN?: string;
  Categories?: { List?: { Name?: string }[] };
  IsAvailable?: boolean;
  IsOfflineSaleOnly?: boolean;
  PromotionLabel?: string;
  PromotionBasedLabel?: string;
  PromotionStartDate?: string;
  PromotionEndDate?: string;
}

// PLUS-huismerken naast "PLUS" zelf (die in de merknaam staat: "PLUS", "Biologisch PLUS", "PLUS Boerentrots")
const OWN_BRANDS = new Set(["bio+", "melkan", "zuivelmeester", "uit de keuken van", "boerentrots"]);
export const isPlusOwnBrand = (b: string) => /\bplus\b/i.test(b) || OWN_BRANDS.has(b.trim().toLowerCase());

const euros = (s: string | undefined) => {
  const n = parseFloat((s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const realDate = (s: string | undefined, endOfDay = false) => (s && !s.startsWith("1900") ? parseDate(s, endOfDay) : null);

export function mapPlus(it: PlusItem, now = new Date()): CrawledProduct | null {
  if (!it.SKU || !it.Name || it.IsAvailable === false || it.IsOfflineSaleOnly) return null;
  const regular = euros(it.OriginalPrice);
  if (!(regular > 0)) return null;

  const brand = (it.Brand ?? "").trim() || "PLUS";
  const ownBrand = isPlusOwnBrand(brand);
  let title = it.Name.trim();
  // Andere eigen lijnen dan "PLUS …" (Zuivelmeester, Melkan…) heten elders gewoon "Halfvolle melk":
  // het merk uit de titel halen laat ze op de inhoud matchen. "PLUS …" wordt in group.ts gestript.
  if (ownBrand && !/\bplus\b/i.test(brand) && title.toLowerCase().startsWith(brand.toLowerCase())) {
    title = title.slice(brand.length).trim() || title;
  }

  const sale = euros(it.NewPrice);
  const label = (it.PromotionLabel || it.PromotionBasedLabel || "").trim();
  const hasPrice = sale > 0 && sale < regular - 0.004;
  const promo =
    hasPrice || label
      ? {
          priceCents: hasPrice ? Math.round(sale * 100) : null,
          label: label || "aanbieding",
          startsAt: realDate(it.PromotionStartDate),
          endsAt: realDate(it.PromotionEndDate, true) ?? weekEnd(now),
        }
      : null;

  const pack = (it.Product_Subtitle ?? "").replace(/^per\s+/i, "").trim() || null;
  const p = parsePack(pack) ?? parsePack(it.Name);
  const priceCents = Math.round(regular * 100);
  const cats = (it.Categories?.List ?? []).map((c) => c.Name ?? "").filter(Boolean);

  return {
    store: "plus",
    externalId: it.SKU,
    title,
    brand,
    ownBrand,
    categoryTop: cats[0] ?? null,
    categoryPath: cats.length ? cats.join(" > ") : null,
    packLabel: pack,
    ean: it.EAN && /^\d{8,14}$/.test(it.EAN) ? it.EAN : null,
    imageUrl: it.ImageURL || null,
    url: it.Slug ? `${BASE}/product/${it.Slug}` : null,
    available: true,
    priceCents,
    unitPriceCents: p && p.size > 0 ? Math.round(priceCents / p.size) : null,
    promo,
  };
}

class Session {
  private cookie = "";
  private moduleVersion = "";
  private apiVersion = FALLBACK_API_VERSION;

  private headers(extra: Record<string, string> = {}) {
    return { "User-Agent": USER_AGENT, ...(this.cookie ? { Cookie: this.cookie } : {}), ...extra };
  }

  async start(): Promise<void> {
    const home = await fetch(`${BASE}/producten`, { headers: { "User-Agent": USER_AGENT } });
    this.cookie = home.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const mv = await fetch(`${BASE}/moduleservices/moduleversioninfo`, { headers: this.headers() });
    this.moduleVersion = ((await mv.json()) as { versionToken: string }).versionToken;
    try {
      const info = await fetch(`${BASE}/ECP_Composition_CW/moduleservices/moduleinfo`, { headers: this.headers() });
      const urls = Object.keys(((await info.json()) as { manifest: { urlVersions: Record<string, string> } }).manifest.urlVersions);
      const mvc = urls.find((u) => u.endsWith("ProductLists.PLP_Content.mvc.js"));
      if (mvc) {
        const js = await (await fetch(`${BASE}${mvc}`, { headers: this.headers() })).text();
        const m = js.match(/"DataActionGetProductListAndCategoryInfo",\s*"[^"]+",\s*"([^"]+)"/);
        if (m) this.apiVersion = m[1];
      }
    } catch {
      /* val terug op de laatst bekende apiVersion */
    }
  }

  async list(pageNumber: number, categorySlug?: string): Promise<{ items: PlusItem[]; totalPages: number; totalItems: number }> {
    const body = {
      versionInfo: { moduleVersion: this.moduleVersion, apiVersion: this.apiVersion },
      viewName: "MainFlow.ProductListPage",
      screenData: { variables: { PageNumber: pageNumber, ...(categorySlug ? { CategorySlug: categorySlug } : {}) } },
      inputParameters: {},
    };
    const res = await fetch(`${BASE}/${ACTION}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json; charset=UTF-8", Accept: "application/json", "X-CSRFToken": "" }),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let j: {
      data?: { ProductList?: { List?: { PLP_Str?: PlusItem }[] }; TotalPages?: number; TotalNumberItems?: number };
      exception?: { message?: string };
      versionInfo?: { hasModuleVersionChanged?: boolean; hasApiVersionChanged?: boolean };
    };
    try {
      j = JSON.parse(text);
    } catch {
      throw new Error(`Plus p${pageNumber} → HTTP ${res.status}, geen JSON`);
    }
    if (j.exception) throw new Error(`Plus p${pageNumber} → ${j.exception.message ?? "fout"} (HTTP ${res.status})`);
    if (j.versionInfo?.hasApiVersionChanged || j.versionInfo?.hasModuleVersionChanged) throw new Error("Plus: versie veranderd");
    return {
      items: (j.data?.ProductList?.List ?? []).map((x) => x.PLP_Str ?? {}),
      totalPages: j.data?.TotalPages ?? 0,
      totalItems: j.data?.TotalNumberItems ?? 0,
    };
  }
}

export const plusCrawler: Crawler = {
  store: "plus",
  async *crawlAll(opts: CrawlOptions = {}) {
    const log = opts.log ?? (() => {});
    const s = new Session();
    await s.start();

    const seen = new Set<string>();
    let totalPages = Infinity;
    let skipped = 0;
    let restarts = 0;
    for (let pageNo = 1; pageNo <= totalPages; ) {
      let r;
      try {
        r = await s.list(pageNo);
      } catch (e) {
        // sessie verlopen of versie veranderd: één keer opnieuw beginnen, dan de pagina overslaan
        if (restarts < 5) {
          restarts++;
          await sleep(2000);
          await s.start();
          continue;
        }
        skipped++;
        log(`Plus pagina ${pageNo}: overgeslagen (${e instanceof Error ? e.message : e})`);
        if (skipped > 30) throw e;
        pageNo++;
        continue;
      }
      restarts = 0;
      if (totalPages === Infinity) {
        totalPages = r.totalPages;
        if (!totalPages) throw new Error("Plus: geen paginatotaal ontvangen");
        log(`Plus: ${r.totalItems} producten in ${totalPages} pagina's`);
      }
      const batch: CrawledProduct[] = [];
      for (const it of r.items) {
        if (!it.SKU || seen.has(it.SKU)) continue;
        seen.add(it.SKU);
        const m = mapPlus(it);
        if (m) batch.push(m);
      }
      if (batch.length) yield batch;
      if (pageNo % 200 === 0) log(`Plus: pagina ${pageNo}/${totalPages} (${seen.size} producten)`);
      pageNo++;
      await sleep(DELAY_MS);
    }
    log(`Plus: ${seen.size} producten${skipped ? `, ${skipped} pagina's overgeslagen` : ""}`);
  },
};
