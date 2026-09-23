import { n1 } from "@/lib/format";

export function Lcd({
  balance,
  low,
  rate,
  daysLeft,
}: {
  balance: number;
  low: boolean;
  rate: number | null;
  daysLeft: number | null;
}) {
  const shown = n1(balance);
  const ghost = shown.replace(/[0-9]/g, "8");

  return (
    <div className="lcd-scan relative overflow-hidden rounded-md border border-black bg-lcd px-4 pt-[18px] pb-3.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.04)]">
      <div
        className={`digits relative font-mono text-[44px] leading-none font-bold tracking-[0.04em] tabular-nums ${
          low ? "warn text-low [text-shadow:0_0_18px_rgba(217,84,43,0.4)]" : "text-amber [text-shadow:0_0_18px_rgba(232,179,58,0.35)]"
        }`}
      >
        <span className="digits-ghost absolute top-0 left-0" aria-hidden="true">
          {ghost}
        </span>
        {shown}
      </div>
      <div className="relative z-10 mt-3 flex items-baseline justify-between">
        <div className="font-mono text-[10px] tracking-[0.16em] text-amber-dim uppercase">
          units left
        </div>
        <div className="font-mono text-[10px] tracking-[0.06em] text-amber-dim">
          {rate
            ? `${n1(rate)}/day${daysLeft !== null ? ` · ~${daysLeft}d` : ""}`
            : "rate pending"}
        </div>
      </div>
    </div>
  );
}
