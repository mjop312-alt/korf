// Prisma-client als singleton (voorkomt "too many connections" bij hot-reload in dev).
//
// Met automatische herpoging bij verbindingsfouten: Neon's gratis compute valt na inactiviteit
// in slaap en de eerste verbinding daarna faalt vaak nog ("Can't reach database server", P1001) of
// wordt midden in een zoekopdracht verbroken (P1017). Zonder herpoging krijgt de eerste bezoeker
// een 500; nu wachten we kort en proberen we het nog een paar keer.

import { PrismaClient } from "@prisma/client";

const RETRY_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const MAX_RETRIES = 3;

function isConnectionError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  if (code && RETRY_CODES.has(code)) return true;
  return (e as { name?: string } | null)?.name === "PrismaClientInitializationError";
}

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  const extended = base.$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (e) {
            if (attempt >= MAX_RETRIES || !isConnectionError(e)) throw e;
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          }
        }
      },
    },
  });
  // het uitgebreide type is niet 1-op-1 toewijsbaar aan PrismaClient (overal in de code gebruikt als
  // parameter-type); runtime gedraagt het zich identiek, plus de herpoging
  return extended as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
