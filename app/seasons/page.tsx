"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Season = { id: string; label: string };

type LeaderboardEntry = {
  user: string;
  wins: number;
  losses: number;
  winPct: string;
  form: string;
  fineTotal: number;
  fineCount: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  bttsPct: string;
  homeWinPct: string;
  awayWinPct: string;
  o2GoalsPct: string;
  avgOdds: string;
  avgWinningOdds: string;
};

type PlayerResults = {
  username: string;
  results: Array<{
    outcome: "W" | "L" | "P" | "V";
    emoji: string | null;
    prediction?: {
      type: string | null;
      match: { homeName: string; awayName: string } | null;
      finalScore?: { home: number; away: number };
      odds?: number;
    };
  }>;
};

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [results, setResults] = useState<PlayerResults[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seasons")
      .then((res) => res.json())
      .then((data) => {
        setSeasons(data);
        if (data.length > 0) setSelectedSeason(data[0].id);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedSeason) return;
    setLoading(true);
    fetch(`/api/seasons?season=${selectedSeason}`)
      .then((res) => res.json())
      .then((data) => {
        setLeaderboard(data.leaderboard);
        setResults(data.results);
        setLoading(false);
      });
  }, [selectedSeason]);

  const getWinRateColor = (winPct: string) => {
    const pct = parseFloat(winPct);
    if (pct >= 70) return "bg-green-600";
    if (pct >= 60) return "bg-green-500";
    if (pct >= 55) return "bg-lime-500";
    if (pct >= 50) return "bg-yellow-500";
    if (pct >= 45) return "bg-amber-500";
    if (pct >= 40) return "bg-orange-500";
    if (pct >= 35) return "bg-orange-600";
    return "bg-red-600";
  };

  if (loading && !selectedSeason) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <p className="text-xl text-slate-300">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Past Seasons</h1>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            ← Back to Current Season
          </Link>
        </div>

        {seasons.length === 0 ? (
          <p className="text-slate-400">No archived seasons yet.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-8">
              {seasons.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSeason(s.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedSeason === s.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-slate-300">Loading season data…</p>
            ) : (
              <>
                {/* Leaderboard */}
                <div className="bg-slate-800 rounded-xl p-6 mb-8 border border-slate-700">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Final Leaderboard
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-slate-400 border-b border-slate-700">
                        <tr>
                          <th className="py-3 px-2">#</th>
                          <th className="py-3 px-2">Player</th>
                          <th className="py-3 px-2">W</th>
                          <th className="py-3 px-2">L</th>
                          <th className="py-3 px-2">Win %</th>
                          <th className="py-3 px-2">Best Streak</th>
                          <th className="py-3 px-2">Worst Streak</th>
                          <th className="py-3 px-2">Fines</th>
                          <th className="py-3 px-2">Avg Odds</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry, i) => (
                          <tr
                            key={entry.user}
                            className="border-b border-slate-700/50 hover:bg-slate-700/30"
                          >
                            <td className="py-3 px-2 text-slate-400">
                              {i + 1}
                            </td>
                            <td className="py-3 px-2 text-white font-medium">
                              {entry.user}
                            </td>
                            <td className="py-3 px-2 text-green-400">
                              {entry.wins}
                            </td>
                            <td className="py-3 px-2 text-red-400">
                              {entry.losses}
                            </td>
                            <td className="py-3 px-2">
                              <span
                                className={`px-2 py-0.5 rounded text-white text-xs font-medium ${getWinRateColor(entry.winPct)}`}
                              >
                                {entry.winPct}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-green-400">
                              {entry.longestWinStreak}W
                            </td>
                            <td className="py-3 px-2 text-red-400">
                              {entry.longestLossStreak}L
                            </td>
                            <td className="py-3 px-2 text-amber-400">
                              £{entry.fineTotal}
                            </td>
                            <td className="py-3 px-2 text-slate-300">
                              {entry.avgOdds}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Results History */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Results History
                  </h2>
                  <div className="space-y-3">
                    {results.map((player) => (
                      <div
                        key={player.username}
                        className="flex items-center gap-3"
                      >
                        <span className="text-slate-300 font-medium w-32 shrink-0">
                          {player.username}
                        </span>
                        <div className="flex gap-0.5 flex-wrap">
                          {player.results
                            .filter((r) => r.outcome !== "P")
                            .map((r, i) => (
                              <span
                                key={i}
                                className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                                  r.outcome === "W"
                                    ? "bg-green-600 text-white"
                                    : r.outcome === "L"
                                      ? "bg-red-600 text-white"
                                      : "bg-slate-600 text-slate-200"
                                }`}
                                title={
                                  r.prediction?.match
                                    ? `${r.prediction.type}: ${r.prediction.match.homeName} vs ${r.prediction.match.awayName}`
                                    : r.outcome === "V"
                                      ? "Void"
                                      : undefined
                                }
                              >
                                {r.outcome}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
