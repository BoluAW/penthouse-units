"use client";

import { n1 } from "@/lib/format";
import type { Entry } from "@/lib/types";

export function EntryLog({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 border-t border-edge pt-1">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex w-full items-center justify-between gap-3 py-2 font-mono text-[11px] tabular-nums text-muted"
        >
          <span>
            {entry.kind === "recharge" ? (
              <>
                Recharged <b className="font-medium text-ink">+{n1(entry.value)}</b>
              </>
            ) : entry.kind === "debit" ? (
              <>
                Debited <b className="font-medium text-low">−{n1(entry.value)}</b>
              </>
            ) : (
              <>
                Meter read <b className="font-medium text-ink">{n1(entry.value)}</b>
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {entry.edited_at && (
              <span className="text-[9px] tracking-[0.1em] text-amber-dim uppercase">edited</span>
            )}
            {new Date(entry.created_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
