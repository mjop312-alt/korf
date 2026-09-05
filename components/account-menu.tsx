"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function AccountMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="hidden h-8 w-16 rounded-full bg-line/40 sm:inline-block" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <Link href="/inloggen" className="text-muted hover:text-ink">
        Inloggen
      </Link>
    );
  }

  const label = session.user.name || session.user.email || "Account";

  return (
    <div className="flex items-center gap-3">
      <Link href="/dashboard" className="hidden text-muted hover:text-ink sm:inline">
        {label.split(" ")[0]}
      </Link>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="font-mono text-xs text-muted hover:text-clay"
      >
        Uitloggen
      </button>
    </div>
  );
}
