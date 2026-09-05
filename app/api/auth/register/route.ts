import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { SUPERMARKETS } from "@/lib/mock-data";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const rate = checkRateLimit(`register:${getClientIp(req)}`, 5, 60 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Te veel registratiepogingen. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" },
      { status: 422 },
    );
  }

  const { name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json(
      { error: "Dit e-mailadres heeft al een account — probeer in te loggen." },
      { status: 409 },
    );
  }

  await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      preference: { create: { selectedStoreIds: SUPERMARKETS.map((s) => s.id) } },
    },
  });

  return NextResponse.json({ ok: true });
}
