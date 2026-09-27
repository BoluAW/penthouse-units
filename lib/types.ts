export type Person = {
  id: string;
  name: string;
  is_admin: boolean;
  loaded: number;
  reading: number;
  threshold: number;
  archived_at: string | null;
};

export type EntryKind = "recharge" | "reading" | "debit";

export type Entry = {
  id: string;
  kind: EntryKind;
  value: number;
  note: string | null;
  created_at: string;
  edited_at: string | null;
};
