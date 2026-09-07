"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, SectionTitle, Select, Tabs, useToast, cx } from "@/components/ui";

type Row = Record<string, unknown> & { id: number; name: string };
type Structure = {
  classes: Row[];
  sections: Row[];
  trades: Row[];
  subjects: Row[];
  chapters: Row[];
  topics: Row[];
};

const ENTITIES = [
  { id: "classes", label: "শ্রেণি" },
  { id: "sections", label: "সেকশন" },
  { id: "trades", label: "ট্রেড" },
  { id: "subjects", label: "বিষয়" },
  { id: "chapters", label: "অধ্যায়" },
  { id: "topics", label: "টপিক" },
] as const;

export default function StructurePage() {
  const { push } = useToast();
  const [data, setData] = useState<Structure | null>(null);
  const [tab, setTab] = useState<string>("classes");
  const [name, setName] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [parent, setParent] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/structure");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/structure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? "ব্যর্থ", "error");
    load();
    return json;
  };

  if (!data) return <p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>;

  const rows = (data[tab as keyof Structure] ?? []) as Row[];
  const parentField =
    tab === "sections" ? "classId" : tab === "chapters" ? "subjectId" : tab === "topics" ? "chapterId" : tab === "subjects" ? "classId" : null;
  const parentOptions =
    parentField === "classId" ? data.classes : parentField === "subjectId" ? data.subjects : parentField === "chapterId" ? data.chapters : [];

  const create = async () => {
    if (!name.trim()) return push("নাম দিন", "error");
    const payload: Record<string, unknown> = { name, nameBn };
    if (tab === "classes") payload.level = Number(name.replace(/\D/g, "")) || 6;
    if (parentField) {
      if (!parent) return push("প্যারেন্ট নির্বাচন করুন", "error");
      payload[parentField] = Number(parent);
    }
    await post({ entity: tab, op: "create", data: payload });
    setName("");
    setNameBn("");
    push("যোগ হয়েছে ✅", "success");
  };

  return (
    <div className="space-y-4">
      <SectionTitle title="🏫 একাডেমিক কাঠামো" subtitle="শ্রেণি, সেকশন, ট্রেড, বিষয়, অধ্যায় ও টপিক পরিচালনা" />
      <Tabs tabs={ENTITIES.map((e) => ({ id: e.id, label: e.label }))} active={tab} onChange={setTab} />

      <Card>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="নাম (English)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="বাংলা নাম" value={nameBn} onChange={(e) => setNameBn(e.target.value)} />
          {parentField ? (
            <Select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">প্যারেন্ট নির্বাচন…</option>
              {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          ) : <span />}
          <Button onClick={create}>+ যোগ করুন</Button>
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.id} padded={false} className="p-3">
            <div className="flex items-center gap-2">
              <input
                defaultValue={r.name}
                onBlur={(e) => e.target.value !== r.name && post({ entity: tab, op: "update", id: r.id, data: { name: e.target.value } })}
                className={cx("min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm font-semibold hover:border-[var(--pg-line)]")}
              />
              <button
                onClick={() => post({ entity: tab, op: "delete", id: r.id })}
                className="px-2 text-rose-500"
                aria-label="delete"
              >
                ✕
              </button>
            </div>
            {r.nameBn ? <p className="px-2 text-xs text-slate-500">{String(r.nameBn)}</p> : null}
          </Card>
        ))}
        {!rows.length ? <p className="p-6 text-sm text-slate-400">কোনো তথ্য নেই</p> : null}
      </div>
    </div>
  );
}
