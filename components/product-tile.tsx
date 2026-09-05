import { accentFor, glyphFor, type TileProduct } from "@/lib/product-visuals";

/**
 * Placeholder-productafbeelding. Toont de categorie-glyph + het merk, met een
 * subtiele merk-tint. `brand === null` ⇒ "geen voorkeur".
 * In productie vervangt <img src={imageUrl}> deze tegel (of next/image).
 */
export function ProductTile({
  product,
  brand,
  size = 54,
}: {
  product: TileProduct;
  brand: string | null;
  size?: number;
}) {
  const accent = accentFor(brand);
  const neutral = brand === null;
  return (
    <div
      className="relative flex-none overflow-hidden rounded-xl border border-line transition-colors"
      style={{ width: size, height: size, background: neutral ? "var(--sunken)" : `${accent}1f` }}
      role="img"
      aria-label={`${product.name}${brand ? ` — ${brand}` : ""}`}
    >
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-center"
        style={{ height: "68%", fontSize: size * 0.42 }}
      >
        {glyphFor(product)}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-center overflow-hidden whitespace-nowrap px-0.5 font-mono uppercase text-ink"
        style={{
          height: "32%",
          fontSize: Math.max(6, size * 0.13),
          background: neutral ? "transparent" : `${accent}30`,
        }}
      >
        {neutral ? <span className="lowercase italic text-muted">geen voorkeur</span> : brand}
      </div>
    </div>
  );
}
