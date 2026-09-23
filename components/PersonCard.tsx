import { n1 } from "@/lib/format";
import { Lcd } from "./Lcd";
import type { ReactNode } from "react";

export function PersonCard({
  name,
  loaded,
  reading,
  threshold,
  rate,
  daysLeft,
  children,
}: {
  name: string;
  loaded: number;
  reading: number;
  threshold: number;
  rate: number | null;
  daysLeft: number | null;
  children?: ReactNode;
}) {
  const balance = loaded - reading;
  const low = balance < threshold;

  return (
    <div className="mt-3.5 rounded-[10px] border border-edge bg-case-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <div className="text-[15px] font-semibold tracking-[0.01em]">{name}</div>
        {low && (
          <div className="rounded-[3px] border border-low/30 bg-low/[0.14] px-[7px] py-1 font-mono text-[9px] tracking-[0.14em] text-low uppercase">
            Low
          </div>
        )}
      </div>

      <Lcd balance={balance} low={low} rate={rate} daysLeft={daysLeft} />

      <div className="mt-3 flex flex-wrap items-baseline gap-1.5 font-mono text-xs tabular-nums text-muted">
        <b className="font-medium text-ink">{n1(loaded)}</b> loaded
        <span>–</span>
        <b className="font-medium text-ink">{n1(reading)}</b> on meter
      </div>

      {children}
    </div>
  );
}
