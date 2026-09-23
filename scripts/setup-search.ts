// Eenmalig, idempotent: zet de PostgreSQL-uitbreiding aan die typo-tolerant zoeken mogelijk
// maakt (pg_trgm) en legt er een index overheen zodat het ook op de volledige catalogus snel
// blijft. Draai dit één keer per database (na db:push, of op een nieuwe Neon-omgeving).
//
//   npm run setup-search

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  console.log("pg_trgm staat aan.");
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "StoreProduct_searchText_trgm_idx" ON "StoreProduct" USING gin ("searchText" gin_trgm_ops)`,
  );
  console.log('Trigram-index op "StoreProduct"."searchText" staat klaar.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
