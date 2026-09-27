import "server-only";
import { supabase } from "./supabase";

export type BoardRow = {
  name: string;
  loaded: number;
  reading: number;
  balance: number;
  low: boolean;
};

/**
 * Everyone currently on the meter, highest balance first.
 *
 * Leaves out archived people, anyone with no entries at all (an account with
 * no opening figures is a login, not a sub-meter), and admins — the admin
 * account here is a utility login rather than a room. If an admin ever does
 * have their own sub-meter, drop the is_admin filter or they'll go missing
 * from the shared image.
 */
export async function getBoard(): Promise<{ rows: BoardRow[]; total: number }> {
  const [{ data: people }, { data: entries }] = await Promise.all([
    supabase
      .from("people")
      .select("id, name, loaded, reading, threshold")
      .is("archived_at", null)
      .eq("is_admin", false),
    supabase.from("entries").select("person_id"),
  ]);

  const onMeter = new Set((entries ?? []).map((e) => e.person_id));

  const rows: BoardRow[] = (people ?? [])
    .filter((p) => onMeter.has(p.id))
    .map((p) => {
      const loaded = Number(p.loaded);
      const reading = Number(p.reading);
      const balance = loaded - reading;
      return { name: p.name, loaded, reading, balance, low: balance < Number(p.threshold) };
    })
    .sort((a, b) => b.balance - a.balance);

  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  return { rows, total };
}
