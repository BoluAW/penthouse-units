"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={pending}
      className="rounded-md border border-edge px-2.5 py-1.5 font-mono text-[11px] tracking-[0.06em] text-muted uppercase transition-colors hover:border-[#4A4433] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:opacity-50"
    >
      {pending ? "…" : "Log out"}
    </button>
  );
}
