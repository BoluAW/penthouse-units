import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentPerson } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Person } from "@/lib/types";

async function requireAdmin(): Promise<{ admin: Person } | { error: NextResponse }> {
  const admin = await getCurrentPerson();
  if (!admin) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!admin.is_admin) return { error: NextResponse.json({ error: "Admin only." }, { status: 403 }) };
  return { admin };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const pin = body?.pin;
  const loaded = Number(body?.loaded);
  const reading = Number(body?.reading);

  if (!name) {
    return NextResponse.json({ error: "Give this person a name." }, { status: 400 });
  }
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 6 digits." }, { status: 400 });
  }
  if (!Number.isFinite(loaded) || loaded <= 0) {
    return NextResponse.json(
      { error: "Total units loaded so far must be greater than zero." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(reading) || reading < 0) {
    return NextResponse.json(
      { error: "Reading on the sub-meter now must be zero or more." },
      { status: 400 }
    );
  }

  const pinHash = await bcrypt.hash(pin, 10);

  const { data: person, error: personError } = await supabase
    .from("people")
    .insert({ name, pin_hash: pinHash })
    .select("id")
    .single();

  if (personError || !person) {
    return NextResponse.json(
      { error: personError?.message ?? "Could not create person." },
      { status: 400 }
    );
  }

  // Both rows land in one statement, so now() would be identical for the
  // pair and `order by created_at desc` ambiguous — which would make
  // undo_last pick either one. Stamp them a second apart instead.
  const openedAt = Date.now();
  const { error: entryError } = await supabase.from("entries").insert([
    {
      person_id: person.id,
      kind: "reading",
      value: reading,
      created_at: new Date(openedAt).toISOString(),
    },
    {
      person_id: person.id,
      kind: "recharge",
      value: loaded,
      created_at: new Date(openedAt + 1000).toISOString(),
    },
  ]);

  if (entryError) {
    await supabase.from("people").delete().eq("id", person.id);
    return NextResponse.json({ error: entryError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, personId: person.id });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const personId = body?.personId;
  if (typeof personId !== "string") {
    return NextResponse.json({ error: "Missing personId." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Give this person a name." }, { status: 400 });
    }
    update.name = name;
  }

  if (body?.pin !== undefined) {
    if (typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin)) {
      return NextResponse.json({ error: "PIN must be 6 digits." }, { status: 400 });
    }
    update.pin_hash = await bcrypt.hash(body.pin, 10);
  }

  if (body?.threshold !== undefined) {
    const threshold = Number(body.threshold);
    if (!Number.isFinite(threshold) || threshold < 0) {
      return NextResponse.json({ error: "Threshold must be zero or more." }, { status: 400 });
    }
    update.threshold = threshold;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase.from("people").update(update).eq("id", personId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const personId = body?.personId;
  const archived = body?.archived;

  if (typeof personId !== "string" || typeof archived !== "boolean") {
    return NextResponse.json({ error: "Missing personId or archived." }, { status: 400 });
  }

  const { error } = await supabase.rpc("archive_person", { p_id: personId, archived });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const personId = body?.personId;
  const permanent = body?.permanent === true;

  if (typeof personId !== "string") {
    return NextResponse.json({ error: "Missing personId." }, { status: 400 });
  }

  const { error } = permanent
    ? await supabase.rpc("remove_person", { p_id: personId, actor_id: auth.admin.id })
    : await supabase.rpc("archive_person", { p_id: personId, archived: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
