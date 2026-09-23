import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { createSession } from "@/lib/session";

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const personId = body?.personId;
  const pin = body?.pin;

  if (typeof personId !== "string" || typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "Enter a 6-digit PIN." }, { status: 400 });
  }

  const { data: person } = await supabase
    .from("people")
    .select("id, pin_hash, is_admin, failed_attempts, locked_until, archived_at")
    .eq("id", personId)
    .maybeSingle();

  if (!person || person.archived_at) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  if (person.locked_until && new Date(person.locked_until) > new Date()) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const valid = await bcrypt.compare(pin, person.pin_hash);

  if (!valid) {
    const attempts = person.failed_attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await supabase
        .from("people")
        .update({
          failed_attempts: 0,
          locked_until: new Date(Date.now() + LOCK_DURATION_MS).toISOString(),
        })
        .eq("id", person.id);
    } else {
      await supabase.from("people").update({ failed_attempts: attempts }).eq("id", person.id);
    }
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  await supabase
    .from("people")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("id", person.id);

  await createSession(person.id);

  return NextResponse.json({ ok: true, isAdmin: person.is_admin });
}
