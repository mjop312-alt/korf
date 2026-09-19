// Korf — alert-trigger-job.
//
//   npm run check-alerts
//
// Controleert elke opgeslagen prijsalert tegen de actuele prijzen in de database.
// Bij een treffer: stuurt een e-mail (als de gebruiker prijsalert-meldingen aan heeft
// staan) en zet `lastTriggeredAt` zodat dezelfde alert niet elk uur opnieuw afgaat.
// Draai dit periodiek via cron (bv. elk uur), net als npm run worker.
//
// Zonder RESEND_API_KEY wordt er geen echte mail verstuurd — dan logt lib/email.ts
// alleen wat er verstuurd zou zijn (dry-run).

import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../lib/email";
import { priceAlertEmail } from "../lib/email-templates";

const db = new PrismaClient();

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// niet elk uur opnieuw "melden" zolang de prijs laag blijft
const RETRIGGER_AFTER_MS = 24 * 3_600_000;

interface NotifySettings {
  priceAlerts: boolean;
  weeklySummary: boolean;
  favouriteOffers: boolean;
}
const NOTIFY_DEFAULT: NotifySettings = { priceAlerts: true, weeklySummary: true, favouriteOffers: true };

function effectiveCents(price: { priceCents: number; isPromo: boolean; promoPriceCents: number | null }): number {
  return price.isPromo && price.promoPriceCents != null ? price.promoPriceCents : price.priceCents;
}

async function wantsPriceAlerts(userId: string): Promise<boolean> {
  const pref = await db.userPreference.findUnique({ where: { userId }, select: { notify: true } });
  const notify = { ...NOTIFY_DEFAULT, ...((pref?.notify as Partial<NotifySettings> | null) ?? {}) };
  return notify.priceAlerts;
}

async function main() {
  const alerts = await db.priceAlert.findMany({
    include: {
      user: { select: { id: true, email: true } },
      canonicalProduct: { select: { name: true, slug: true } },
    },
  });

  let triggered = 0;
  let mailed = 0;
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

    if (!best || best.cents > alert.thresholdCents) continue;

    triggered++;
    console.log(
      `[alert] ${alert.user.email} — ${alert.canonicalProduct.name} nu € ${(best.cents / 100).toFixed(2)} bij ${best.storeName} (drempel € ${(alert.thresholdCents / 100).toFixed(2)})`,
    );

    if (await wantsPriceAlerts(alert.user.id)) {
      const mail = priceAlertEmail({
        productName: alert.canonicalProduct.name,
        priceCents: best.cents,
        storeName: best.storeName,
        thresholdCents: alert.thresholdCents,
        productUrl: `${SITE_URL}/product/${alert.canonicalProduct.slug}`,
      });
      const r = await sendEmail({ to: alert.user.email, ...mail });
      if (r.sent) mailed++;
      if (r.error) console.error(`  e-mail mislukt: ${r.error}`);
    } else {
      console.log("  (gebruiker heeft prijsalert-meldingen uit — geen mail)");
    }

    await db.priceAlert.update({ where: { id: alert.id }, data: { lastTriggeredAt: new Date() } });
  }

  console.log(`${triggered} van ${alerts.length} alert(s) getriggerd, ${mailed} e-mail(s) verstuurd.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
