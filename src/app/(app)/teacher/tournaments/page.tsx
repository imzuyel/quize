"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  SectionTitle,
  Select,
  Table,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";

type Tournament = { id: number; name: string; description: string | null; stage: string; status: string };
type Entry = { id: number; tournamentId: number; playerName: string; stage: string; score: number; qualified: boolean };
type Challenge = { id: number; title: string; metric: string; endsAt: string | null };
type Playlist = { id: number; name: string; description: string | null; quizIds: number[] };

export default function TournamentsPage() {
  const { push } = useToast();
  const [tab, setTab] = useState("tournaments");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [quizzes, setQuizzes] = useState<{ id: number; title: string }[]>([]);
  const [name, setName] = useState("PGTSC ডিজিটাল কুইজ চ্যাম্পিয়নশিপ");
  const [desc, setDesc] = useState("ক্লাস রাউন্ড → ট্রেড রাউন্ড → স্কুল রাউন্ড → ফাইনাল");
  const [challengeTitle, setChallengeTitle] = useState("সাপ্তাহিক নির্ভুলতা চ্যালেঞ্জ");
  const [metric, setMetric] = useState("accuracy");
  const [playlistName, setPlaylistName] = useState("HTML মাস্টারক্লাস");
  const [selectedQuizzes, setSelectedQuizzes] = useState<number[]>([]);
  const [syncQuiz, setSyncQuiz] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/tournaments");
    if (res.ok) {
      const d = await res.json();
      setTournaments(d.tournaments);
      setEntries(d.entries);
      setChallenges(d.challenges);
      setPlaylists(d.playlists);
    }
    const q = await fetch("/api/quizzes?mine=1");
    if (q.ok) setQuizzes((await q.json()).rows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/tournaments", {
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

  return (
    <div className="space-y-4">
      <SectionTitle title="🏆 টুর্নামেন্ট, চ্যালেঞ্জ ও লার্নিং পাথ" subtitle="স্কুল-ব্যাপী প্রতিযোগিতা পরিচালনা করুন" />
      <Tabs
        tabs={[
          { id: "tournaments", label: "টুর্নামেন্ট", icon: "🏆" },
          { id: "challenges", label: "ক্লাস চ্যালেঞ্জ", icon: "🎯" },
          { id: "playlists", label: "কুইজ প্লেলিস্ট", icon: "📚" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "tournaments" ? (
        <div className="space-y-4">
          <Card>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="নাম"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="বিবরণ"><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
            </div>
            <Button className="mt-3" onClick={() => post({ op: "createTournament", name, description: desc })}>
              + টুর্নামেন্ট তৈরি করুন
            </Button>
          </Card>

          {tournaments.length === 0 ? (
            <EmptyState icon="🏆" title="কোনো টুর্নামেন্ট নেই" />
          ) : (
            tournaments.map((t) => {
              const list = entries.filter((e) => e.tournamentId === t.id);
              return (
                <Card key={t.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{t.name}</h3>
                    <Badge tone="teal">{t.stage}</Badge>
                    <Badge tone={t.status === "open" ? "green" : "slate"}>{t.status}</Badge>
                    <div className="flex-1" />
                    <Select value={syncQuiz} onChange={(e) => setSyncQuiz(e.target.value)} className="w-auto">
                      <option value="">কুইজ ফলাফল যুক্ত করুন…</option>
                      {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                    </Select>
                    <Button size="sm" onClick={() => post({ op: "syncEntries", id: t.id, quizId: Number(syncQuiz) })} disabled={!syncQuiz}>
                      যুক্ত করুন
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => post({ op: "advanceStage", id: t.id })}>
                      পরবর্তী রাউন্ড →
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => post({ op: "deleteTournament", id: t.id })}>মুছুন</Button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t.description}</p>
                  {list.length ? (
                    <div className="mt-3">
                      <Table head={["#", "শিক্ষার্থী", "রাউন্ড", "স্কোর", "যোগ্যতা"]}>
                        {list.slice(0, 15).map((e, i) => (
                          <tr key={e.id}>
                            <td className="px-3 py-2">{i + 1}</td>
                            <td className="px-3 py-2">{e.playerName}</td>
                            <td className="px-3 py-2">{e.stage}</td>
                            <td className="px-3 py-2 font-bold">{Math.round(e.score)}</td>
                            <td className="px-3 py-2">{e.qualified ? "✅ উত্তীর্ণ" : "—"}</td>
                          </tr>
                        ))}
                      </Table>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">এখনো কোনো এন্ট্রি নেই।</p>
                  )}
                </Card>
              );
            })
          )}
        </div>
      ) : null}

      {tab === "challenges" ? (
        <div className="space-y-4">
          <Card>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="চ্যালেঞ্জের শিরোনাম">
                <Input value={challengeTitle} onChange={(e) => setChallengeTitle(e.target.value)} />
              </Field>
              <Field label="র‍্যাংকিং মেট্রিক">
                <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
                  <option value="accuracy">নির্ভুলতা</option>
                  <option value="improvement">উন্নতি</option>
                  <option value="participation">অংশগ্রহণ</option>
                  <option value="completion">সম্পন্নতা</option>
                </Select>
              </Field>
            </div>
            <Button className="mt-3" onClick={() => post({ op: "createChallenge", title: challengeTitle, metric })}>
              + চ্যালেঞ্জ তৈরি
            </Button>
          </Card>
          {challenges.length === 0 ? (
            <EmptyState icon="🎯" title="কোনো চ্যালেঞ্জ নেই" />
          ) : (
            <Card padded={false}>
              <Table head={["শিরোনাম", "মেট্রিক", "শেষ তারিখ", ""]}>
                {challenges.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-semibold">{c.title}</td>
                    <td className="px-3 py-2"><Badge tone="gold">{c.metric}</Badge></td>
                    <td className="px-3 py-2 text-xs">{c.endsAt ? new Date(c.endsAt).toLocaleDateString("bn-BD") : "—"}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="ghost" onClick={() => post({ op: "deleteChallenge", id: c.id })}>মুছুন</Button>
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </div>
      ) : null}

      {tab === "playlists" ? (
        <div className="space-y-4">
          <Card>
            <Field label="প্লেলিস্টের নাম"><Input value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} /></Field>
            <p className="mt-3 mb-1 text-xs font-semibold text-slate-600">কুইজ নির্বাচন করুন (ক্রমানুসারে)</p>
            <div className="flex flex-wrap gap-1.5">
              {quizzes.map((q) => (
                <button
                  key={q.id}
                  onClick={() =>
                    setSelectedQuizzes((s) => (s.includes(q.id) ? s.filter((x) => x !== q.id) : [...s, q.id]))
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                    selectedQuizzes.includes(q.id) ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]"
                  }`}
                >
                  {q.title}
                </button>
              ))}
            </div>
            <Button
              className="mt-3"
              onClick={() => post({ op: "createPlaylist", name: playlistName, quizIds: selectedQuizzes })}
            >
              + লার্নিং পাথ তৈরি
            </Button>
          </Card>
          {playlists.length === 0 ? (
            <EmptyState icon="📚" title="কোনো প্লেলিস্ট নেই" />
          ) : (
            playlists.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{p.name}</h3>
                  <Badge tone="blue">{(p.quizIds ?? []).length} কুইজ</Badge>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={() => post({ op: "deletePlaylist", id: p.id })}>মুছুন</Button>
                </div>
                <Textarea className="mt-2" defaultValue={p.description ?? ""} readOnly />
              </Card>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
