"use client";

import { useState } from "react";

export function ShareBoardButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/board", { cache: "no-store" });
      if (!res.ok) {
        setErr((await res.text()) || "Could not build the image.");
        return;
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `units-${stamp}.png`, { type: "image/png" });

      // Phone: hand it straight to the share sheet.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (e) {
          // Cancelling the sheet throws AbortError — not an error worth showing.
          if ((e as Error)?.name === "AbortError") return;
        }
      }

      // Desktop, or no share sheet: save it.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Could not build the image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3.5">
      <button
        onClick={share}
        disabled={busy}
        className="w-full rounded-md border border-edge py-2.5 text-[13px] font-semibold hover:border-[#4A4433] hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:opacity-50"
      >
        {busy ? "Building…" : "Share balances"}
      </button>
      {err && <div className="mt-2 text-xs leading-relaxed text-low">{err}</div>}
    </div>
  );
}
