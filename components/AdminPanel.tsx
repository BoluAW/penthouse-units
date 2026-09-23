"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PersonCard } from "./PersonCard";
import { ShareBoardButton } from "./ShareBoardButton";
import { n1 } from "@/lib/format";
import type { PersonSummary } from "@/lib/summary";
import type { Entry } from "@/lib/types";

type Mode = "load" | "read" | "log" | "edit";
type ArchivedPerson = { id: string; name: string; archivedAt: string };

const JSON_HEADERS = { "Content-Type": "application/json" };

async function callApi(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function AdminPanel({
  initialPeople,
  archivedPeople,
}: {
  initialPeople: PersonSummary[];
  archivedPeople: ArchivedPerson[];
}) {
  const router = useRouter();
  const people = initialPeople;

  const [open, setOpen] = useState<Record<string, Mode | undefined>>({});
  const [errs, setErrs] = useState<Record<string, string | undefined>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [undoMsg, setUndoMsg] = useState<Record<string, string | undefined>>({});
  const [confirmDelete, setConfirmDelete] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  function openForm(id: string, mode: Mode) {
    setOpen({ [id]: mode });
    setErrs({});
    setConfirmDelete({});
  }
  function cancel(id: string) {
    setOpen((o) => ({ ...o, [id]: undefined }));
    setErrs((e) => ({ ...e, [id]: undefined }));
    setConfirmDelete((c) => ({ ...c, [id]: false }));
  }

  async function submitEntry(id: string, mode: "load" | "read", raw: string) {
    const value = parseFloat(raw);
    if (isNaN(value)) {
      setErrs((e) => ({ ...e, [id]: "Type a number first." }));
      return;
    }
    setPending(id);
    const { ok, data } = await callApi("/api/admin/entry", "POST", {
      personId: id,
      kind: mode === "load" ? "recharge" : "reading",
      value,
    });
    setPending(null);
    if (!ok) {
      setErrs((e) => ({ ...e, [id]: data?.error ?? "Something went wrong." }));
      return;
    }
    cancel(id);
    router.refresh();
  }

  async function undo(id: string) {
    setPending(id);
    const { ok, data } = await callApi("/api/admin/undo", "POST", { personId: id });
    setPending(null);
    if (!ok) {
      setUndoMsg((m) => ({ ...m, [id]: data?.error ?? "Nothing to undo." }));
    } else {
      const removed = data?.removed;
      const label =
        removed?.kind === "recharge"
          ? `Removed recharge of ${n1(removed.value)}`
          : `Removed reading of ${n1(removed?.value ?? 0)}`;
      setUndoMsg((m) => ({ ...m, [id]: label }));
      router.refresh();
    }
    setTimeout(() => setUndoMsg((m) => ({ ...m, [id]: undefined })), 5000);
  }

  async function saveEntryEdit(entryId: string, value: number): Promise<string | null> {
    if (!Number.isFinite(value)) return "Type a number first.";
    setPending(entryId);
    const { ok, data } = await callApi("/api/admin/entry", "PATCH", { entryId, value });
    setPending(null);
    if (!ok) return data?.error ?? "Something went wrong.";
    router.refresh();
    return null;
  }

  async function deleteEntryRow(entryId: string): Promise<string | null> {
    setPending(entryId);
    const { ok, data } = await callApi("/api/admin/entry", "DELETE", { entryId });
    setPending(null);
    if (!ok) return data?.error ?? "Something went wrong.";
    router.refresh();
    return null;
  }

  async function saveEdit(id: string, formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const pin = String(formData.get("pin") ?? "");
    const thresholdRaw = String(formData.get("threshold") ?? "");

    const body: Record<string, unknown> = { personId: id };
    if (name) body.name = name;
    if (pin) body.pin = pin;
    if (thresholdRaw !== "") body.threshold = parseFloat(thresholdRaw);

    setPending(id);
    const { ok, data } = await callApi("/api/admin/person", "PATCH", body);
    setPending(null);
    if (!ok) {
      setErrs((e) => ({ ...e, [id]: data?.error ?? "Something went wrong." }));
      return;
    }
    cancel(id);
    router.refresh();
  }

  async function archivePerson(id: string) {
    setPending(id);
    const { ok, data } = await callApi("/api/admin/person", "DELETE", { personId: id });
    setPending(null);
    if (!ok) {
      setErrs((e) => ({ ...e, [id]: data?.error ?? "Something went wrong." }));
      return;
    }
    cancel(id);
    router.refresh();
  }

  async function permanentDelete(id: string) {
    setPending(id);
    const { ok, data } = await callApi("/api/admin/person", "DELETE", {
      personId: id,
      permanent: true,
    });
    setPending(null);
    if (!ok) {
      setErrs((e) => ({ ...e, [id]: data?.error ?? "Something went wrong." }));
      return;
    }
    cancel(id);
    router.refresh();
  }

  async function restorePerson(id: string) {
    setPending(id);
    await callApi("/api/admin/person", "PUT", { personId: id, archived: false });
    setPending(null);
    router.refresh();
  }

  async function addPerson(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const pin = String(formData.get("pin") ?? "");
    const loaded = String(formData.get("loaded") ?? "");
    const reading = String(formData.get("reading") ?? "");

    setPending("NEW");
    const { ok, data } = await callApi("/api/admin/person", "POST", {
      name,
      pin,
      loaded: parseFloat(loaded),
      reading: parseFloat(reading),
    });
    setPending(null);
    if (!ok) {
      setAddErr(data?.error ?? "Something went wrong.");
      return;
    }
    setAddOpen(false);
    setAddErr(null);
    router.refresh();
  }

  return (
    <div>
      {people.length === 0 ? (
        <div className="mt-8 rounded-[10px] border border-dashed border-edge px-5 py-7 text-center text-sm leading-relaxed text-muted">
          Nobody&rsquo;s on the meter yet.
          <br />
          Add the first person with their total loaded and their current
          sub-meter reading.
        </div>
      ) : (
        people.map((s) => {
          const id = s.person.id;
          return (
            <PersonCard
              key={id}
              name={s.person.name}
              loaded={s.person.loaded}
              reading={s.person.reading}
              threshold={s.person.threshold}
              rate={s.rate}
              daysLeft={s.daysLeft}
            >
              {open[id] === "load" && (
                <EntryForm
                  label="Units recharged"
                  placeholder="e.g. 50"
                  hint={`15 service fee deducted automatically. ${n1(s.person.loaded)} already loaded.`}
                  error={errs[id]}
                  submitLabel="Add units"
                  busy={pending === id}
                  onCancel={() => cancel(id)}
                  onSubmit={(v) => submitEntry(id, "load", v)}
                />
              )}

              {open[id] === "read" && (
                <EntryForm
                  label="Reading on the sub-meter now"
                  placeholder={`e.g. ${n1(s.person.reading + 5)}`}
                  hint={`Last reading was ${n1(s.person.reading)}.`}
                  error={errs[id]}
                  submitLabel="Save reading"
                  busy={pending === id}
                  onCancel={() => cancel(id)}
                  onSubmit={(v) => submitEntry(id, "read", v)}
                />
              )}

              {open[id] === "log" && (
                <div className="mt-3 border-t border-edge pt-1">
                  {s.entries.map((h) => (
                    <LogRow
                      key={h.id}
                      entry={h}
                      busy={pending === h.id}
                      onSave={(v) => saveEntryEdit(h.id, v)}
                      onDelete={() => deleteEntryRow(h.id)}
                    />
                  ))}
                  <button
                    onClick={() => cancel(id)}
                    className="mt-2 w-full rounded-md border border-edge py-2.5 text-[13px] font-semibold hover:bg-white/[0.04]"
                  >
                    Close
                  </button>
                </div>
              )}

              {open[id] === "edit" && (
                <div className="mt-3.5 border-t border-edge pt-3.5">
                  <form action={(fd) => saveEdit(id, fd)} className="flex flex-col gap-3.5">
                    <div>
                      <label
                        htmlFor={`edit-name-${id}`}
                        className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase"
                      >
                        Name
                      </label>
                      <input
                        id={`edit-name-${id}`}
                        name="name"
                        type="text"
                        defaultValue={s.person.name}
                        className="w-full rounded-md border border-edge bg-lcd px-3 py-3 font-mono text-base text-ink focus:border-amber focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-pin-${id}`}
                        className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase"
                      >
                        New PIN (leave blank to keep the same)
                      </label>
                      <input
                        id={`edit-pin-${id}`}
                        name="pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="••••••"
                        className="w-full rounded-md border border-edge bg-lcd px-3 py-3 font-mono text-base tabular-nums text-ink focus:border-amber focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-threshold-${id}`}
                        className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase"
                      >
                        Flag below
                      </label>
                      <input
                        id={`edit-threshold-${id}`}
                        name="threshold"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        defaultValue={s.person.threshold}
                        className="w-full rounded-md border border-edge bg-lcd px-3 py-3 font-mono text-base tabular-nums text-ink focus:border-amber focus:outline-none"
                      />
                    </div>
                    {errs[id] && <div className="text-xs leading-relaxed text-low">{errs[id]}</div>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={pending === id}
                        className="flex-1 rounded-md border border-amber bg-amber py-2.5 text-[13px] font-semibold text-case hover:bg-[#F0C155] disabled:opacity-50"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => cancel(id)}
                        className="flex-1 rounded-md border border-edge py-2.5 text-[13px] font-semibold hover:bg-white/[0.04]"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>

                  <div className="mt-3.5 border-t border-edge pt-3">
                    {!confirmDelete[id] ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => archivePerson(id)}
                          disabled={pending === id}
                          className="rounded-md px-2.5 py-2 text-xs font-medium text-muted hover:bg-white/[0.05] hover:text-ink disabled:opacity-50"
                        >
                          Archive {s.person.name}
                        </button>
                        <span className="flex-1" />
                        <button
                          onClick={() => setConfirmDelete((c) => ({ ...c, [id]: true }))}
                          className="rounded-md px-2.5 py-2 text-xs font-medium text-muted hover:bg-low/10 hover:text-low"
                        >
                          Delete permanently
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs leading-relaxed text-muted">
                          Delete {s.person.name} and all {s.entries.length >= 8 ? "their" : s.entries.length}{" "}
                          entries logged for them? This can&rsquo;t be undone.
                        </div>
                        <div className="mt-2.5 flex gap-2">
                          <button
                            onClick={() => permanentDelete(id)}
                            disabled={pending === id}
                            className="flex-1 rounded-md border border-low bg-low py-2.5 text-[13px] font-semibold text-white hover:bg-[#E8663C] disabled:opacity-50"
                          >
                            Delete permanently
                          </button>
                          <button
                            onClick={() => setConfirmDelete((c) => ({ ...c, [id]: false }))}
                            className="flex-1 rounded-md border border-edge py-2.5 text-[13px] font-semibold hover:bg-white/[0.04]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!open[id] && (
                <>
                  <div className="mt-3.5 flex gap-2">
                    <button
                      onClick={() => openForm(id, "load")}
                      className="flex-1 rounded-md border border-amber bg-amber py-2.5 text-[13px] font-semibold text-case hover:bg-[#F0C155]"
                    >
                      Add recharge
                    </button>
                    <button
                      onClick={() => openForm(id, "read")}
                      className="flex-1 rounded-md border border-edge py-2.5 text-[13px] font-semibold hover:border-[#4A4433] hover:bg-white/[0.04]"
                    >
                      Update meter
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      onClick={() => undo(id)}
                      disabled={s.entries.length < 2 || pending === id}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-white/[0.05] hover:text-ink disabled:opacity-30"
                    >
                      Undo last
                    </button>
                    <button
                      onClick={() => openForm(id, "log")}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-white/[0.05] hover:text-ink"
                    >
                      Log
                    </button>
                    <span className="flex-1" />
                    <button
                      onClick={() => openForm(id, "edit")}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-white/[0.05] hover:text-ink"
                    >
                      Edit
                    </button>
                  </div>
                  {undoMsg[id] && (
                    <div className="mt-1.5 px-2.5 font-mono text-[11px] text-ok">{undoMsg[id]}</div>
                  )}
                </>
              )}
            </PersonCard>
          );
        })
      )}

      {addOpen ? (
        <div className="mt-3.5 rounded-[10px] border border-edge bg-case-2 p-4">
          <div className="mb-3 text-[15px] font-semibold">New person</div>
          <form action={(fd) => addPerson(fd)} className="flex flex-col gap-3.5">
            <div>
              <label htmlFor="nName" className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
                Name
              </label>
              <input
                id="nName"
                name="name"
                type="text"
                placeholder="Barber"
                autoFocus
                className="w-full rounded-md border border-edge bg-lcd px-3 py-3 font-mono text-base tabular-nums text-ink focus:border-amber focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="nPin" className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
                6-digit PIN
              </label>
              <input
                id="nPin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                className="w-full rounded-md border border-edge bg-lcd px-3 py-3 font-mono text-base tabular-nums text-ink focus:border-amber focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="nLoad" className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
                Total units loaded so far
              </label>
              <input
                id="nLoad"
                name="loaded"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="1743.5"
                className="w-full rounded-md border border-edge bg-lcd px-3 py-3 font-mono text-base tabular-nums text-ink focus:border-amber focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="nRead" className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
                Reading on their sub-meter now
              </label>
              <input
                id="nRead"
                name="reading"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="1731.9"
                className="w-full rounded-md border border-edge bg-lcd px-3 py-3 font-mono text-base tabular-nums text-ink focus:border-amber focus:outline-none"
              />
            </div>
            {addErr && <div className="text-xs leading-relaxed text-low">{addErr}</div>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending === "NEW"}
                className="flex-1 rounded-md border border-amber bg-amber py-2.5 text-[13px] font-semibold text-case hover:bg-[#F0C155] disabled:opacity-50"
              >
                Add to the meter
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setAddErr(null);
                }}
                className="flex-1 rounded-md border border-edge py-2.5 text-[13px] font-semibold hover:bg-white/[0.04]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-3.5">
          <button
            onClick={() => setAddOpen(true)}
            className="w-full rounded-md border border-edge py-2.5 text-[13px] font-semibold hover:border-[#4A4433] hover:bg-white/[0.04]"
          >
            Add a person
          </button>
        </div>
      )}

      {people.length > 0 && <ShareBoardButton />}

      {archivedPeople.length > 0 && (
        <div className="mt-6 border-t border-edge pt-4">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase underline underline-offset-2 hover:text-ink"
          >
            {showArchived ? "Hide archived" : `${archivedPeople.length} archived`}
          </button>
          {showArchived && (
            <div className="mt-3 flex flex-col gap-2">
              {archivedPeople.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-edge px-3.5 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted">
                      archived{" "}
                      {new Date(p.archivedAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => restorePerson(p.id)}
                    disabled={pending === p.id}
                    className="rounded-md border border-edge px-3 py-2 text-xs font-semibold hover:border-[#4A4433] hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntryForm({
  label,
  placeholder,
  hint,
  error,
  submitLabel,
  busy,
  onCancel,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  hint: string;
  error?: string;
  submitLabel: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-3.5 border-t border-edge pt-3.5">
      <label className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-edge bg-lcd px-3 py-3 font-mono text-base tabular-nums text-ink focus:border-amber focus:outline-none"
      />
      {error && <div className="mt-2 text-xs leading-relaxed text-low">{error}</div>}
      <div className="mt-2 text-xs leading-relaxed text-muted">{hint}</div>
      <div className="mt-3.5 flex gap-2">
        <button
          onClick={() => onSubmit(value)}
          disabled={busy}
          className="flex-1 rounded-md border border-amber bg-amber py-2.5 text-[13px] font-semibold text-case hover:bg-[#F0C155] disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 rounded-md border border-edge py-2.5 text-[13px] font-semibold hover:bg-white/[0.04]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function LogRow({
  entry,
  busy,
  onSave,
  onDelete,
}: {
  entry: Entry;
  busy: boolean;
  onSave: (value: number) => Promise<string | null>;
  onDelete: () => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(entry.value));
  const [err, setErr] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(entry.value));
          setErr(null);
          setEditing(true);
        }}
        className="flex w-full items-center justify-between gap-3 py-2 text-left font-mono text-[11px] tabular-nums text-muted hover:text-ink"
      >
        <span>
          {entry.kind === "recharge" ? (
            <>
              Recharged <b className="font-medium text-ink">+{n1(entry.value)}</b>
            </>
          ) : (
            <>
              Meter read <b className="font-medium text-ink">{n1(entry.value)}</b>
            </>
          )}
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {entry.edited_at && (
            <span className="text-[9px] tracking-[0.1em] text-amber-dim uppercase">edited</span>
          )}
          {new Date(entry.created_at).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          })}
        </span>
      </button>
    );
  }

  return (
    <div className="py-2">
      <div className="flex gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-edge bg-lcd px-2.5 py-2 font-mono text-sm tabular-nums text-ink focus:border-amber focus:outline-none"
        />
        <button
          onClick={async () => {
            const e = await onSave(parseFloat(value));
            if (e) setErr(e);
            else setEditing(false);
          }}
          disabled={busy}
          className="shrink-0 rounded-md border border-amber bg-amber px-3 text-xs font-semibold text-case hover:bg-[#F0C155] disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={async () => {
            const e = await onDelete();
            if (e) setErr(e);
          }}
          disabled={busy}
          className="shrink-0 rounded-md border border-low px-3 text-xs font-semibold text-low hover:bg-low/10 disabled:opacity-50"
        >
          Delete
        </button>
        <button
          onClick={() => setEditing(false)}
          className="shrink-0 rounded-md border border-edge px-3 text-xs font-semibold hover:bg-white/[0.04]"
        >
          Cancel
        </button>
      </div>
      {err && <div className="mt-1.5 text-[11px] leading-relaxed text-low">{err}</div>}
    </div>
  );
}
