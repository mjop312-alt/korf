// Korf — alert-trigger-job.
//
//   npm run check-alerts
//
// Controleert elke opgeslagen prijsalert tegen de actuele prijzen in de database
// en logt welke gebruiker een melding zou moeten krijgen. Draai dit periodiek via
// cron (bv. elk uur), net als scripts/ingest.ts.
//
// LET OP: dit verstuurt nog GEEN echte e-mail/notificatie — er is nog geen
// e-mailprovider aangesloten (zie /instellingen > meldingen, "weeklySummary" heeft
// hetzelfde probleem). Dit script legt wel vast wanneer een alert getriggerd is
// (`lastTriggeredAt`), zodat een latere e-mail-integratie alleen deze query hoeft
// aan te roepen en te vervangen door een echte verzendstap.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// niet elk uur opnieuw "melden" zolang de prijs laag blijft
const RETRIGGER_AFTER_MS = 24 * 3_600_000;

function effectiveCents(price: { priceCents: number; isPromo: boolean; promoPriceCents: number | null }): number {
  return price.isPromo && price.promoPriceCents != null ? price.promoPriceCents : price.priceCents;
}

async function main() {
  const alerts = await db.priceAlert.findMany({
    include: {
      user: { select: { email: true } },
      canonicalProduct: { select: { name: true, slug: true } },
    },
  });

  let triggered = 0;
  for (const alert of alerts) {
    if (alert.lastTriggeredAt && Date.now() - alert.lastTriggeredAt.getTime() < RETRIGGER_AFTER_MS) continue;

    const storeScope = Array.isArray(alert.storeScope) ? (alert.storeScope as string[]) : null;
    const storeProducts = await db.storeProduct.findMany({
      where: {
        canonicalProductId: alert.canonicalProductId,
        available: true,
        ...(storeScope?.length ? { supermarket: { slug: { in: storeScope } } } : {}),
      },
      include: { price: true, supermarket: { select: { name: true } } },
    });

    let best: { storeName: string; cents: number } | null = null;
    for (const sp of storeProducts) {
      if (!sp.price) continue;
      const cents = effectiveCents(sp.price);
      if (!best || cents < best.cents) best = { storeName: sp.supermarket.name, cents };
    }

    if (best && best.cents <= alert.thresholdCents) {
      triggered++;
      console.log(
        `[alert] ${alert.user.email} — ${alert.canonicalProduct.name} nu € ${(best.cents / 100).toFixed(2)} bij ${best.storeName} (drempel € ${(alert.thresholdCents / 100).toFixed(2)})`,
      );
      await db.priceAlert.update({ where: { id: alert.id }, data: { lastTriggeredAt: new Date() } });
    }
  }

  console.log(`${triggered} van ${alerts.length} alert(s) getriggerd.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
