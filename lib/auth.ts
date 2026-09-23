import "server-only";
import { cookies } from "next/headers";
import { supabase } from "./supabase";
import { SESSION_COOKIE } from "./session";
import type { Person } from "./types";

/** Resolves the session cookie to a person. Null if absent, expired, or invalid. */
export async function getCurrentPerson(): Promise<Person | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data: session } = await supabase
    .from("sessions")
    .select("person_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  const { data: person } = await supabase
    .from("people")
    .select("id, name, is_admin, loaded, reading, threshold, archived_at")
    .eq("id", session.person_id)
    .maybeSingle();

  return person ?? null;
}
