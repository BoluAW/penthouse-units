import { NextResponse } from "next/server";
import { getCurrentPerson } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const admin = await getCurrentPerson();
  if (!admin) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!admin.is_admin) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const personId = body?.personId;
  if (typeof personId !== "string") {
    return NextResponse.json({ error: "Missing personId." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("undo_last", { p_id: personId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, removed: data });
}
