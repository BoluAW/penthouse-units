import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabase } from "./supabase";

export const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(personId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex"); // 256 bits
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const { error } = await supabase
    .from("sessions")
    .insert({ token, person_id: personId, expires_at: expiresAt.toISOString() });
  if (error) throw error;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await supabase.from("sessions").delete().eq("token", token);
  }
  cookieStore.delete(SESSION_COOKIE);
}
