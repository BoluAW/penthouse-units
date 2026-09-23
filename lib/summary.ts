import "server-only";
import { supabase } from "./supabase";
import { calcRate, calcDaysLeft } from "./rate";
import type { Entry, Person } from "./types";

export type PersonSummary = {
  person: Pick<Person, "id" | "name" | "loaded" | "reading" | "threshold">;
  balance: number;
  rate: number | null;
  daysLeft: number | null;
  entries: Entry[];
};

/** Balance, burn rate, and the last 8 log entries for one person. */
export async function getPersonSummary(personId: string): Promise<PersonSummary | null> {
  const { data: person } = await supabase
    .from("people")
    .select("id, name, loaded, reading, threshold")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return null;

  const [{ data: entries }, { data: lastReadings }] = await Promise.all([
    supabase
      .from("entries")
      .select("id, kind, value, note, created_at, edited_at")
      .eq("person_id", personId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("entries")
      .select("value, created_at")
      .eq("person_id", personId)
      .eq("kind", "reading")
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  const balance = person.loaded - person.reading;
  const rate = calcRate([...(lastReadings ?? [])].reverse());
  const daysLeft = calcDaysLeft(balance, rate);

  return {
    person,
    balance,
    rate,
    daysLeft,
    entries: entries ?? [],
  };
}
