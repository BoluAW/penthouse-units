import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getPersonSummary } from "@/lib/summary";
import { AdminPanel } from "@/components/AdminPanel";
import { LogoutButton } from "@/components/LogoutButton";
import { n1 } from "@/lib/format";

export default async function AdminPage() {
  const admin = await getCurrentPerson();
  if (!admin) redirect("/");
  if (!admin.is_admin) redirect("/me");

  const { data: people } = await supabase
    .from("people")
    .select("id, name, archived_at")
    .order("name", { ascending: true });

  const activeIds = (people ?? []).filter((p) => !p.archived_at).map((p) => p.id);
  const archivedPeople = (people ?? [])
    .filter((p) => p.archived_at)
    .map((p) => ({ id: p.id, name: p.name, archivedAt: p.archived_at as string }));

  const summaries = await Promise.all(activeIds.map((id) => getPersonSummary(id)));
  const adminPeople = summaries.filter((s) => s !== null);

  const houseTotal = adminPeople.reduce((sum, s) => sum + s.balance, 0);

  return (
    <div className="mx-auto max-w-[560px] px-4 pt-5 pb-12">
      <div className="flex items-end justify-between gap-4 border-b border-edge pb-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
            Shared prepaid meter
          </div>
          <h1 className="mt-1.5 text-[26px] leading-none font-bold tracking-[-0.02em]">
            Units
          </h1>
        </div>
        <div className="flex items-end gap-3">
          <div className="text-right font-mono leading-none">
            <span className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
              In the house
            </span>
            <div className="text-xl font-medium tabular-nums">
              {adminPeople.length ? n1(houseTotal) : "–"}
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>

      <AdminPanel initialPeople={adminPeople} archivedPeople={archivedPeople} />
    </div>
  );
}
