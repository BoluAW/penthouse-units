"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PersonOption = { id: string; name: string };

export function LoginForm({ people }: { people: PersonOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<PersonOption | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || pin.length !== 6) return;
    setPending(true);
    setError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: selected.id, pin }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data?.error ?? "Something went wrong.");
      setPin("");
      setPending(false);
      return;
    }

    router.push(data.isAdmin ? "/admin" : "/me");
    router.refresh();
  }

  if (!selected) {
    return (
      <div className="mt-3.5 rounded-[10px] border border-edge bg-case-2 p-4">
        <div className="mb-3 font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
          Who&rsquo;s this?
        </div>
        {people.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-edge px-5 py-7 text-center text-sm leading-relaxed text-muted">
            Nobody&rsquo;s set up yet. Run the setup script to add the admin.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="rounded-md border border-edge px-3.5 py-3 text-left text-[15px] font-medium transition-colors hover:border-[#4A4433] hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3.5 rounded-[10px] border border-edge bg-case-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[15px] font-semibold">{selected.name}</div>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setPin("");
            setError(null);
          }}
          className="font-mono text-[11px] tracking-[0.06em] text-muted uppercase underline underline-offset-2 hover:text-ink"
        >
          Not you?
        </button>
      </div>

      <label htmlFor="pin" className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
        6-digit PIN
      </label>
      <input
        id="pin"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full rounded-md border border-edge bg-lcd px-3 py-3 font-mono text-lg tabular-nums text-ink focus:border-amber focus:outline-none"
        placeholder="••••••"
      />
      {error && <div className="mt-2 text-xs leading-relaxed text-low">{error}</div>}

      <div className="mt-3.5 flex gap-2">
        <button
          type="submit"
          disabled={pin.length !== 6 || pending}
          className="flex-1 rounded-md border border-amber bg-amber py-2.5 text-[13px] font-semibold text-case transition-colors hover:bg-[#F0C155] disabled:opacity-50"
        >
          {pending ? "Checking…" : "Log in"}
        </button>
      </div>
    </form>
  );
}
