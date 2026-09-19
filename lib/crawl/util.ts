// Gedeelde hulpjes voor de crawlers: beleefd fetchen met retry, en verpakkingstekst parsen.

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** fetch → JSON, met exponentiële backoff bij 429/5xx/netwerkfouten (en Lidl's losse 406). */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; label?: string } = {},
): Promise<T> {
  const retries = opts.retries ?? 4;
  const label = opts.label ?? url;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return (await res.json()) as T;
      lastErr = new Error(`${label} → HTTP ${res.status}`);
      // 4xx (behalve 429/406) heeft geen zin om te herhalen
      if (res.status < 500 && res.status !== 429 && res.status !== 406) throw lastErr;
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && /HTTP 4\d\d/.test(e.message) && !/HTTP (429|406)/.test(e.message)) throw e;
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  throw lastErr;
}

/** Laatste getal in een tekst als centen: "prijs per kg € 9,62" → 962. */
export function lastNumberCents(text: string | null | undefined): number | null {
  if (!text) return null;
  const nums = [...text.matchAll(/\d+(?:[.,]\d+)?/g)];
  if (!nums.length) return null;
  const v = parseFloat(nums[nums.length - 1][0].replace(",", "."));
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

/** Einde van de huidige week (zondag 23:59:59) — vangnet als een winkel geen einddatum geeft. */
export function weekEnd(from = new Date()): Date {
  const d = new Date(from);
  const daysToSunday = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + daysToSunday);
  d.setHours(23, 59, 59, 0);
  return d;
}

/**
 * Verpakkingstekst → hoeveelheid in basiseenheid (kg / litre / piece).
 * "6 x 1 L" → 6 l · "2 x 500 g" → 1 kg · "330 ml" → 0,33 l · "12 stuks" → 12 piece.
 */
export function parsePack(label: string | null | undefined): { size: number; unit: "kg" | "litre" | "piece" } | null {
  if (!label) return null;
  const m = label
    .toLowerCase()
    .replace(/,/g, ".")
    .match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|gram|g|liter|litre|l|cl|ml|stuks|stuk|st)\b/);
  if (!m) return null;
  const mult = m[1] ? parseInt(m[1], 10) : 1;
  const value = parseFloat(m[2]) * mult;
  switch (m[3]) {
    case "kg":
      return { size: value, unit: "kg" };
    case "g":
    case "gram":
      return { size: value / 1000, unit: "kg" };
    case "l":
    case "liter":
    case "litre":
      return { size: value, unit: "litre" };
    case "cl":
      return { size: value / 100, unit: "litre" };
    case "ml":
      return { size: value / 1000, unit: "litre" };
    default:
      return { size: value, unit: "piece" };
  }
}

/** "2026-09-22" of ISO met "[Europe/Amsterdam]"-suffix (Jumbo) → Date; ongeldig ⇒ null. */
export function parseDate(s: string | null | undefined, endOfDay = false): Date | null {
  if (!s) return null;
  const clean = s.replace(/\[.*\]$/, "");
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(clean);
  const d = new Date(dateOnly ? `${clean}T${endOfDay ? "23:59:59" : "00:00:00"}` : clean);
  return Number.isNaN(d.getTime()) ? null : d;
}
