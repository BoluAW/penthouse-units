import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/auth";
import { getPersonSummary } from "@/lib/summary";
import { PersonCard } from "@/components/PersonCard";
import { LogoutButton } from "@/components/LogoutButton";
import { EntryLog } from "@/components/EntryLog";

export default async function MePage() {
  const person = await getCurrentPerson();
  if (!person) redirect("/");

  const summary = await getPersonSummary(person.id);
  if (!summary) redirect("/");

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
        <LogoutButton />
      </div>

      <PersonCard
        name={summary.person.name}
        loaded={summary.person.loaded}
        reading={summary.person.reading}
        threshold={summary.person.threshold}
        rate={summary.rate}
        daysLeft={summary.daysLeft}
      >
        <EntryLog entries={summary.entries} />
      </PersonCard>
    </div>
  );
}
