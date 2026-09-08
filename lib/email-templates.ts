// Korf — e-mailsjablonen. Inline styles (e-mailclients strippen <style> en laden geen
// webfonts), Korf-kleuren, plaintext-fallback erbij.

const C = {
  ground: "#f6f1e6",
  raised: "#fcfaf3",
  ink: "#17202b",
  text: "#33322d",
  muted: "#6e6858",
  sage: "#5f7355",
  brass: "#84632f",
  line: "#dfd6c1",
};

const euro = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

function shell(bodyHtml: string, footerNote: string): string {
  return `<!doctype html>
<html lang="nl"><body style="margin:0;background:${C.ground};font-family:Georgia,'Times New Roman',serif;color:${C.text}">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:22px;letter-spacing:-.5px;color:${C.ink};font-weight:400">k<b>or</b>f<span style="color:${C.brass}">.</span></div>
    <div style="margin-top:24px;background:${C.raised};border:1px solid ${C.line};border-radius:16px;padding:24px">
      ${bodyHtml}
    </div>
    <p style="margin-top:20px;font-size:12px;color:${C.muted};font-family:-apple-system,'Segoe UI',sans-serif">
      ${footerNote} Je kunt meldingen aanpassen onder Instellingen &rarr; Meldingen.
    </p>
  </div>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;background:${C.ink};color:${C.ground};text-decoration:none;font-family:-apple-system,'Segoe UI',sans-serif;font-size:14px;font-weight:600;padding:10px 20px;border-radius:12px">${label}</a>`;
}

export interface PriceAlertEmailInput {
  productName: string;
  priceCents: number;
  storeName: string;
  thresholdCents: number;
  productUrl: string;
}

export function priceAlertEmail(i: PriceAlertEmailInput): { subject: string; html: string; text: string } {
  const subject = `${i.productName} is gezakt naar ${euro(i.priceCents)} bij ${i.storeName}`;
  const html = shell(
    `<h1 style="margin:0;font-size:20px;font-weight:400;color:${C.ink}">Je prijsalert is afgegaan</h1>
     <p style="margin:12px 0 0;font-size:15px;line-height:1.5">
       <strong>${i.productName}</strong> kost nu
       <strong style="color:${C.sage}">${euro(i.priceCents)}</strong> bij ${i.storeName}.
       Je drempel stond op ${euro(i.thresholdCents)}.
     </p>
     ${button(i.productUrl, "Bekijk het product")}`,
    "Je krijgt deze mail omdat je een prijsalert voor dit product hebt ingesteld.",
  );
  const text = [
    "Je prijsalert is afgegaan",
    "",
    `${i.productName} kost nu ${euro(i.priceCents)} bij ${i.storeName}.`,
    `Je drempel stond op ${euro(i.thresholdCents)}.`,
    "",
    i.productUrl,
  ].join("\n");
  return { subject, html, text };
}

export interface WeeklySummaryEmailInput {
  firstName: string;
  weekSavingCents: number;
  weekTrips: number;
  monthSavingCents: number;
  lifetimeSavingCents: number;
  lifetimeTrips: number;
  dashboardUrl: string;
}

export function weeklySummaryEmail(i: WeeklySummaryEmailInput): { subject: string; html: string; text: string } {
  const subject = `Je bespaarde deze week ${euro(i.weekSavingCents)}`;
  const tripWord = i.weekTrips === 1 ? "boodschappentrip" : "boodschappentrips";
  const html = shell(
    `<h1 style="margin:0;font-size:20px;font-weight:400;color:${C.ink}">Hoi ${i.firstName || "daar"},</h1>
     <p style="margin:12px 0 0;font-size:15px;line-height:1.5">
       Afgelopen week: <strong>${i.weekTrips} ${tripWord}</strong>,
       <strong style="color:${C.sage}">${euro(i.weekSavingCents)}</strong> bespaard.
     </p>
     <table style="margin-top:16px;width:100%;border-collapse:collapse;font-size:14px">
       <tr><td style="padding:6px 0;border-top:1px solid ${C.line};color:${C.muted}">Deze maand</td>
           <td style="padding:6px 0;border-top:1px solid ${C.line};text-align:right;color:${C.sage}">${euro(i.monthSavingCents)}</td></tr>
       <tr><td style="padding:6px 0;border-top:1px solid ${C.line};color:${C.muted}">Sinds het begin (${i.lifetimeTrips} trips)</td>
           <td style="padding:6px 0;border-top:1px solid ${C.line};text-align:right;color:${C.sage}">${euro(i.lifetimeSavingCents)}</td></tr>
     </table>
     ${button(i.dashboardUrl, "Bekijk je dashboard")}`,
    "Je krijgt deze wekelijkse samenvatting omdat die aanstaat in je meldingsinstellingen.",
  );
  const text = [
    `Hoi ${i.firstName || "daar"},`,
    "",
    `Afgelopen week: ${i.weekTrips} ${tripWord}, ${euro(i.weekSavingCents)} bespaard.`,
    `Deze maand: ${euro(i.monthSavingCents)}.`,
    `Sinds het begin: ${euro(i.lifetimeSavingCents)} over ${i.lifetimeTrips} trips.`,
    "",
    i.dashboardUrl,
  ].join("\n");
  return { subject, html, text };
}
