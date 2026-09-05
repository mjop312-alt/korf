// /lijst — ingelogd: door naar je actieve lijst. Uitgelogd: de gast-samensteller
// (zonder opslaan), zodat een eerste bezoeker het meteen kan proberen.

import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-chrome";
import { getOrCreateActiveList, getUserId } from "@/lib/lists";
import { GuestListBuilder } from "./guest-list-builder";

export const dynamic = "force-dynamic";

export default async function LijstPage() {
  const userId = await getUserId();
  if (userId) {
    const list = await getOrCreateActiveList(userId);
    redirect(`/lijst/${list.id}`);
  }

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <GuestListBuilder />
    </div>
  );
}
