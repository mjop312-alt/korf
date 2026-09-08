// Korf — e-mailverzending. Dunne wrapper om de Resend REST-API (geen SDK-dependency:
// het is één POST met een Bearer-token). Zonder RESEND_API_KEY is dit een no-op die
// alleen logt — net als de Sentry-setup, zodat lokale dev zonder e-mailaccount blijft
// werken. Aanzetten: maak een gratis account op resend.com, verifieer een domein (of
// gebruik onboarding@resend.dev voor een test), en zet RESEND_API_KEY + EMAIL_FROM in .env.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  sent: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Korf <onboarding@resend.dev>";

  if (!key) {
    console.log(`[email:dry-run] → ${msg.to} · "${msg.subject}" (geen RESEND_API_KEY)`);
    return { sent: false };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    const j = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: j.id };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
