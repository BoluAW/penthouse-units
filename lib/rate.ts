const SIX_HOURS_IN_DAYS = 6 / 24;

/**
 * Burn rate from the last two meter readings, oldest first.
 * Null until there are two readings more than 6 hours apart with positive usage.
 */
export function calcRate(
  lastTwoReadings: { value: number; created_at: string }[]
): number | null {
  if (lastTwoReadings.length < 2) return null;
  const [a, b] = lastTwoReadings;
  const days =
    (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) /
    86_400_000;
  const used = b.value - a.value;
  if (days <= SIX_HOURS_IN_DAYS || used <= 0) return null;
  return used / days;
}

export function calcDaysLeft(balance: number, rate: number | null): number | null {
  if (rate === null || balance <= 0) return null;
  return Math.floor(balance / rate);
}
