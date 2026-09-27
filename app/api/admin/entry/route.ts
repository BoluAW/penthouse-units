import { NextResponse } from "next/server";
import { getCurrentPerson } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

async function requireAdmin() {
  const admin = await getCurrentPerson();
  if (!admin) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!admin.is_admin) return { error: NextResponse.json({ error: "Admin only." }, { status: 403 }) };
  return { admin };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const personId = body?.personId;
  const kind = body?.kind;
  const value = Number(body?.value);

  if (
    typeof personId !== "string" ||
    (kind !== "recharge" && kind !== "reading" && kind !== "debit") ||
    !Number.isFinite(value)
  ) {
    return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
  }

  if (kind === "debit") {
    if (value <= 0) {
      return NextResponse.json({ error: "Debit value must be greater than zero." }, { status: 400 });
    }

    const { error } = await supabase.from("entries").insert({ person_id: personId, kind, value });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, debited: value });
  }

  const fee = kind === "recharge" ? Number(body?.fee ?? 0) : 0;
  if (!Number.isFinite(fee) || fee < 0) {
    return NextResponse.json({ error: "Service fee must be zero or more." }, { status: 400 });
  }

  const credited = value - fee;

  if (kind === "recharge" && credited <= 0) {
    return NextResponse.json(
      { error: `Recharge must be more than ${fee} to cover the service fee.` },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("entries").insert({ person_id: personId, kind, value: credited });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, credited });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const entryId = body?.entryId;
  const value = Number(body?.value);

  if (typeof entryId !== "string" || !Number.isFinite(value)) {
    return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("entries")
    .update({ value, edited_at: new Date().toISOString() })
    .eq("id", entryId)
    .select("id, kind, value, note, created_at, edited_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, entry: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const entryId = body?.entryId;

  if (typeof entryId !== "string") {
    return NextResponse.json({ error: "Missing entryId." }, { status: 400 });
  }

  const { error } = await supabase.from("entries").delete().eq("id", entryId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
