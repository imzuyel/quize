"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  SectionTitle,
  Select,
  Table,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";

type User = {
  id: number;
  name: string;
  email: string;
  studentId: string | null;
  role: string;
  classId: number | null;
  roll: string | null;
  xp: number;
  active: boolean;
  status: string;
  createdAt: string;
  rejectionNote: string | null;
};

function UsersPageInner() {
  const params = useSearchParams();
  const { push } = useToast();
  const [rows, setRows] = useState<User[]>([]);
  const [pending, setPending] = useState<User[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedPending, setSelectedPending] = useState<number[]>([]);
  const [rejecting, setRejecting] = useState<User | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [role, setRole] = useState(params.get("tab") === "pending" ? "pending" : "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("name,studentId,roll\nমোঃ রাকিব,PG-2025200,25");
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [draft, setDraft] = useState({ name: "", email: "", role: "student", studentId: "", roll: "", classId: "", password: "" });
  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin?scope=users${role && role !== "pending" ? `&role=${role}` : ""}`);
    if (res.ok) {
      const d = await res.json();
      setRows(d.rows);
      setPendingCount(d.pendingCount ?? 0);
    }
    const p = await fetch("/api/admin?scope=users&status=pending");
    if (p.ok) setPending((await p.json()).rows);
  }, [role]);

  useEffect(() => {
    load();
    fetch("/api/structure").then(async (r) => r.ok && setClasses((await r.json()).classes));
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      push(data.error ?? "ব্যর্থ", "error");
      return null;
    }
    load();
    return data;
  };

  const filtered = rows.filter(
    (r) => !query || r.name.toLowerCase().includes(query.toLowerCase()) || r.email.includes(query) || (r.studentId ?? "").includes(query),
  );

  return (
    <div className="space-y-4">
      <SectionTitle
        title="👥 ইউজার ম্যানেজমেন্ট"
        subtitle="শিক্ষক, শিক্ষার্থী, অভিভাবক ও অ্যাডমিন"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>📥 বাল্ক ইমপোর্ট</Button>
            <Button onClick={() => setOpen(true)}>+ নতুন ইউজার</Button>
          </div>
        }
      />

      <Tabs
        tabs={[
          { id: "pending", label: `⏳ অনুমোদন (${pendingCount})` },
          { id: "", label: "সব" },
          { id: "student", label: "শিক্ষার্থী" },
          { id: "teacher", label: "শিক্ষক" },
          { id: "parent", label: "অভিভাবক" },
          { id: "admin", label: "অ্যাডমিন" },
        ]}
        active={role}
        onChange={(v) => { setRole(v); setSelectedPending([]); }}
      />

      {role === "pending" ? (
        pending.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-500">
              ✅ অপেক্ষমাণ কোনো আবেদন নেই।
            </p>
          </Card>
        ) : (
          <>
            <Card className="border-amber-200 bg-amber-50">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm">{pending.length}টি আবেদন অপেক্ষমাণ</b>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPending(pending.map((p) => p.id))}
                >
                  সব নির্বাচন
                </Button>
                <Button
                  size="sm"
                  disabled={!selectedPending.length}
                  onClick={async () => {
                    const d = await post({ op: "bulkApprove", ids: selectedPending });
                    if (d) {
                      push(`${d.approved}টি অনুমোদিত ✅`, "success");
                      setSelectedPending([]);
                    }
                  }}
                >
                  ✅ নির্বাচিত অনুমোদন ({selectedPending.length})
                </Button>
              </div>
            </Card>

            <div className="space-y-2">
              {pending.map((u) => (
                <Card key={u.id} padded={false} className="p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={selectedPending.includes(u.id)}
                      onChange={(e) =>
                        setSelectedPending((s) =>
                          e.target.checked ? [...s, u.id] : s.filter((x) => x !== u.id),
                        )
                      }
                      aria-label={`select ${u.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone={u.role === "teacher" ? "blue" : "slate"}>{u.role}</Badge>
                        <Badge tone="gold">
                          {new Date(u.createdAt).toLocaleDateString("bn-BD")}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Select
                        className="w-auto py-1 text-xs"
                        value={u.role}
                        onChange={(e) => post({ op: "updateUser", id: u.id, role: e.target.value })}
                      >
                        {["student", "teacher", "parent", "admin"].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await post({ op: "approveUser", id: u.id });
                          push(`${u.name} অনুমোদিত ✅`, "success");
                        }}
                      >
                        ✅ অনুমোদন
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => { setRejecting(u); setRejectNote(""); }}
                      >
                        ✕ প্রত্যাখ্যান
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )
      ) : null}

      {role !== "pending" ? (
      <Card padded={false} className="p-3">
        <Input placeholder="🔍 নাম, ইমেইল বা স্টুডেন্ট আইডি" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Card>
      ) : null}

      {role !== "pending" ? (
      <Card padded={false}>
        <Table head={["নাম", "ইমেইল", "আইডি", "ভূমিকা", "XP", "অবস্থা", ""]}>
          {filtered.slice(0, 200).map((u) => (
            <tr key={u.id}>
              <td className="px-3 py-2 font-semibold">{u.name}</td>
              <td className="px-3 py-2 text-xs">{u.email}</td>
              <td className="px-3 py-2 text-xs">{u.studentId ?? "—"}</td>
              <td className="px-3 py-2">
                <Select
                  className="w-auto py-1 text-xs"
                  value={u.role}
                  onChange={(e) => post({ op: "updateUser", id: u.id, role: e.target.value })}
                >
                  {["student", "teacher", "parent", "admin", "super_admin"].map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </td>
              <td className="px-3 py-2 tabular-nums">{u.xp}</td>
              <td className="px-3 py-2">
                {u.status === "pending" ? (
                  <Badge tone="gold">⏳ অপেক্ষমাণ</Badge>
                ) : u.status === "rejected" ? (
                  <Badge tone="coral">প্রত্যাখ্যাত</Badge>
                ) : (
                  <button onClick={() => post({ op: "updateUser", id: u.id, active: !u.active })}>
                    <Badge tone={u.active ? "green" : "slate"}>{u.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</Badge>
                  </button>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  {u.status !== "approved" ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await post({ op: "approveUser", id: u.id });
                        push("অনুমোদিত ✅", "success");
                      }}
                    >
                      অনুমোদন
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const d = await post({ op: "updateUser", id: u.id, password: "__reset__" });
                      if (d?.newPassword) setIssued({ name: u.name, password: d.newPassword });
                    }}
                  >
                    পাসওয়ার্ড রিসেট
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => post({ op: "deleteUser", id: u.id })}>মুছুন</Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="নতুন ইউজার"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button
              onClick={async () => {
                const data = await post({
                  op: "createUser",
                  ...draft,
                  classId: draft.classId ? Number(draft.classId) : null,
                });
                if (data) {
                  push("ইউজার তৈরি হয়েছে ✅", "success");
                  setOpen(false);
                  if (data.initialPassword) setIssued({ name: draft.name, password: data.initialPassword });
                  setDraft({ name: "", email: "", role: "student", studentId: "", roll: "", classId: "", password: "" });
                }
              }}
            >
              তৈরি করুন
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="নাম" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="ইমেইল" required><Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
          <Field label="ভূমিকা">
            <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              {["student", "teacher", "parent", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          {draft.role === "student" ? (
            <div className="grid grid-cols-3 gap-2">
              <Field label="স্টুডেন্ট আইডি"><Input value={draft.studentId} onChange={(e) => setDraft({ ...draft, studentId: e.target.value })} /></Field>
              <Field label="রোল"><Input value={draft.roll} onChange={(e) => setDraft({ ...draft, roll: e.target.value })} /></Field>
              <Field label="শ্রেণি">
                <Select value={draft.classId} onChange={(e) => setDraft({ ...draft, classId: e.target.value })}>
                  <option value="">—</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </div>
          ) : null}
          <Field label="পাসওয়ার্ড" hint="খালি রাখলে সিস্টেম একটি নিরাপদ পাসওয়ার্ড তৈরি করে দেবে (কমপক্ষে ৮ অক্ষর)">
            <Input
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              placeholder="স্বয়ংক্রিয়ভাবে তৈরি হবে"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="আবেদন প্রত্যাখ্যান"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>বাতিল</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!rejecting) return;
                await post({ op: "rejectUser", id: rejecting.id, note: rejectNote });
                push("প্রত্যাখ্যান করা হয়েছে", "success");
                setRejecting(null);
              }}
            >
              প্রত্যাখ্যান করুন
            </Button>
          </>
        }
      >
        <p className="text-sm">
          <b>{rejecting?.name}</b> ({rejecting?.email}) — এর আবেদন প্রত্যাখ্যান করবেন?
        </p>
        <Textarea
          className="mt-3"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="কারণ (ঐচ্ছিক) — লগইনের সময় ব্যবহারকারী এটি দেখতে পাবেন"
        />
      </Modal>

      <Modal
        open={Boolean(issued)}
        onClose={() => setIssued(null)}
        title="পাসওয়ার্ড তৈরি হয়েছে"
        footer={<Button onClick={() => setIssued(null)}>বন্ধ করুন</Button>}
      >
        <p className="text-sm">
          <b>{issued?.name}</b> — এই পাসওয়ার্ডটি এখনই সংরক্ষণ করুন, পরে আর দেখানো হবে না।
        </p>
        <p className="mt-3 select-all rounded-xl bg-slate-900 px-4 py-3 text-center font-mono text-xl font-bold text-white">
          {issued?.password}
        </p>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="স্কুল সিস্টেম থেকে শিক্ষার্থী ইমপোর্ট"
        footer={
          <Button
            onClick={async () => {
              const lines = csv.trim().split("\n");
              const headers = lines[0].split(",").map((h) => h.trim());
              const rowsIn = lines.slice(1).map((l) => {
                const cells = l.split(",");
                return Object.fromEntries(headers.map((h, i) => [h, cells[i]?.trim() ?? ""]));
              });
              const data = await post({ op: "importStudents", rows: rowsIn });
              if (data) {
                push(`${data.imported}টি যোগ, ${data.skipped}টি বাদ`, "success");
                setImportOpen(false);
                if (data.credentials?.length) {
                  const csvOut = "name,email,password\n" +
                    data.credentials.map((c: { name: string; email: string; password: string }) =>
                      `${c.name},${c.email},${c.password}`).join("\n");
                  const blob = new Blob(["\uFEFF" + csvOut], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "student-passwords.csv";
                  a.click();
                  push("পাসওয়ার্ড ফাইল ডাউনলোড হয়েছে — নিরাপদে রাখুন", "success");
                }
              }
            }}
          >
            ইমপোর্ট করুন
          </Button>
        }
      >
        <p className="mb-2 text-xs text-slate-500">
          বিদ্যমান স্কুল ম্যানেজমেন্ট সিস্টেম থেকে CSV পেস্ট করুন (name, studentId, roll, email)। বিদ্যমান আইডি ডুপ্লিকেট হবে না।
        </p>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} className="min-h-[160px] font-mono text-xs" />
      </Modal>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>}>
      <UsersPageInner />
    </Suspense>
  );
}
