"use client";

import { useEffect, useState } from "react";

type LeaderBoardData = { 
  user: string; 
  wins: number; 
  losses: number; 
  winPct: string;
  fineTotal: number;
  fineCount: number;
  longestWinStreak: number;
  longestLossStreak: number;
};

export default function Leaderboard({ selectedPlayer }: { selectedPlayer?: string }) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderBoardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const res = await fetch("/api/picks");
        const users = await res.json();
        setLeaderboardData(users);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <p className="text-xl text-slate-300">Loading leaderboard…</p>
    </div>
  );
  
  if (error) return (
    <div className="flex items-center justify-center p-8">
      <p className="text-xl text-red-400">Error: {error}</p>
    </div>
  );

  return (
    <div className="mb-12">
      <h2 className="text-4xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="text-yellow-400">🏆</span> Leaderboard
      </h2>
      <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-700 to-slate-600 border-b border-slate-600">
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">Rank</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">Player</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-200">Wins</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-200">Losses</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-200">Win Rate</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-200">Best Streak</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-200">Worst Streak</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-200">Fines (£)</th>
            </tr>
          </thead>
          <tbody>
            {leaderboardData
              .sort((a, b) => parseFloat(b.winPct) - parseFloat(a.winPct))
              .map((u, index) => (
                <tr
                  key={u.user}
                  className={`border-b border-slate-700 transition-colors ${
                    index % 2 === 0 ? "bg-slate-800" : "bg-slate-750"
                  } hover:bg-slate-700 ${
                    u.user === selectedPlayer ? "border-l-4 border-l-yellow-400" : ""
                  }`}
                >
                  <td className="px-6 py-4 text-sm font-bold text-yellow-400">
                    {index === 0 && "🥇"}
                    {index === 1 && "🥈"}
                    {index === 2 && "🥉"}
                    {index === 5 && "💩"}
                    {index > 2 && index !== 5 && `${index + 1}.`}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-white">{u.user}</td>
                  <td className="px-6 py-4 text-sm text-center text-green-400 font-semibold">{u.wins}</td>
                  <td className="px-6 py-4 text-sm text-center text-red-400 font-semibold">{u.losses}</td>
                  <td className="px-6 py-4 text-sm text-center font-bold">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs">
                      {u.winPct}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                      🔥 {u.longestWinStreak}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                      💀 {u.longestLossStreak}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                      £{u.fineTotal}
                    </span>
                    <div className="text-[11px] text-amber-200 mt-1">{u.fineCount} hits</div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
