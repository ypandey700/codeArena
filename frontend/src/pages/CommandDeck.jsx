import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import api from "../services/api";

export default function CommandDeck({ onQuickDuel }) {
  const { user } = useAuth();
  const { joinQueue } = useBattle();
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const result = await api.get("/arena/stats"); if (active) setStats(result.data?.data ?? null); }
      catch { if (active) setStats(null); }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const record = user?.stats || {};
  const matches = (record.wins || 0) + (record.losses || 0) + (record.draws || 0);
  const metrics = [
    ["Arena rating", `${user?.rating ?? 1200} RR`],
    ["Wins / losses / draws", `${record.wins || 0} / ${record.losses || 0} / ${record.draws || 0}`],
    ["Win rate", `${matches ? Math.round((record.wins || 0) / matches * 100) : 0}%`],
    ["Problems solved", record.problemsSolved || 0],
    ["Submissions", record.submissions || 0],
    ["Experience", `${user?.xp || 0} XP`],
  ];
  return <main className="mx-auto max-w-6xl px-5 py-10 text-on-surface">
    <p className="text-xs uppercase tracking-widest text-[#fddf49]">Command deck</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">Welcome back, {user?.username || "Player"}</h1><Link className="text-sm text-[#fddf49]" to={`/u/${user?.username}`}>View profile →</Link></div>
    <section className="mt-8 grid gap-4 sm:grid-cols-3">{metrics.map(([label, value]) => <article key={label} className="rounded-xl border border-white/10 bg-[#16191c] p-5"><p className="text-xs text-muted">{label}</p><p className="mt-3 text-2xl font-semibold text-[#fddf49]">{value}</p></article>)}</section>
    <section className="mt-8 rounded-xl border border-white/10 bg-[#16191c] p-6"><h2 className="text-xl font-semibold">Ranked 1v1 duel</h2><p className="mt-3 text-sm leading-6 text-on-surface-variant">Solve the same challenge as your opponent, then explain the decisions in your code. Your solution and interview contribute to your final score.</p><p role="status" className="mt-4 text-sm text-muted">{stats ? `${stats.online ?? 0} online · ${stats.inQueue ?? 0} in queue` : "Live arena activity unavailable"}</p><button onClick={() => { joinQueue("ranked_1v1"); onQuickDuel?.(); }} className="mt-5 rounded-lg bg-[#fddf49] px-6 py-3 text-sm font-semibold text-black">Enter 1v1 queue</button><Link to="/battle-modes" className="ml-5 text-sm text-[#fddf49]">Browse modes</Link></section>
  </main>;
}
