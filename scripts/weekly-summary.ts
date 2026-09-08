// Korf — wekelijkse besparingssamenvatting.
//
//   npm run weekly-summary
//
// Stuurt elke gebruiker die afgelopen 7 dagen minstens één boodschappentrip afrondde
// (en de wekelijkse samenvatting aan heeft staan) een mailtje met wat ze bespaarden,
// deze week / deze maand / sinds het begin. Draai dit één keer per week via cron.
//
// Geen trip deze week ⇒ geen mail (geen lege "je bespaarde € 0"-berichten).
// Zonder RESEND_API_KEY logt lib/email.ts alleen wat er verstuurd zou zijn (dry-run).

import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../lib/email";
import { weeklySummaryEmail } from "../lib/email-templates";

const db = new PrismaClient();

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface NotifySettings {
  priceAlerts: boolean;
  weeklySummary: boolean;
  favouriteOffers: boolean;
}
const NOTIFY_DEFAULT: NotifySettings = { priceAlerts: true, weeklySummary: true, favouriteOffers: true };

async function main() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // gebruikers met minstens één trip afgelopen week
  const recent = await db.savingsRecord.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: weekAgo } },
    _sum: { savingCents: true },
    _count: true,
  });

  let sent = 0;
  for (const row of recent) {
    const [user, pref, monthAgg, lifetimeAgg] = await Promise.all([
      db.user.findUnique({ where: { id: row.userId }, select: { email: true, name: true } }),
      db.userPreference.findUnique({ where: { userId: row.userId }, select: { notify: true } }),
      db.savingsRecord.aggregate({
        where: { userId: row.userId, createdAt: { gte: monthStart } },
        _sum: { savingCents: true },
      }),
      db.savingsRecord.aggregate({ where: { userId: row.userId }, _sum: { savingCents: true }, _count: true }),
    ]);
    if (!user) continue;

    const notify = { ...NOTIFY_DEFAULT, ...((pref?.notify as Partial<NotifySettings> | null) ?? {}) };
    if (!notify.weeklySummary) {
      console.log(`[weekly] ${user.email} — samenvatting uit, overgeslagen`);
      continue;
    }

    const mail = weeklySummaryEmail({
      firstName: user.name?.split(" ")[0] ?? "",
      weekSavingCents: row._sum.savingCents ?? 0,
      weekTrips: row._count,
      monthSavingCents: monthAgg._sum.savingCents ?? 0,
      lifetimeSavingCents: lifetimeAgg._sum.savingCents ?? 0,
      lifetimeTrips: lifetimeAgg._count,
      dashboardUrl: `${SITE_URL}/dashboard`,
    });
    const r = await sendEmail({ to: user.email, ...mail });
    if (r.sent) sent++;
    if (r.error) console.error(`  e-mail mislukt voor ${user.email}: ${r.error}`);
  }

  console.log(`${recent.length} gebruiker(s) met trips deze week, ${sent} samenvatting(en) verstuurd.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
