import { NextResponse } from "next/server";
import { getCurrentPerson } from "@/lib/auth";
import { getPersonSummary } from "@/lib/summary";

export async function GET() {
  const person = await getCurrentPerson();
  if (!person) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const summary = await getPersonSummary(person.id);
  if (!summary) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(summary);
}
