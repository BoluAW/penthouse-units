import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const current = await getCurrentPerson();
  if (current) redirect(current.is_admin ? "/admin" : "/me");

  const { data: people } = await supabase
    .from("people")
    .select("id, name")
    .is("archived_at", null)
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-[560px] px-4 pt-5 pb-12">
      <div className="border-b border-edge pb-4">
        <div className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
          Shared prepaid meter
        </div>
        <h1 className="mt-1.5 text-[26px] leading-none font-bold tracking-[-0.02em]">
          Units
        </h1>
      </div>

      <LoginForm people={people ?? []} />
    </div>
  );
}
