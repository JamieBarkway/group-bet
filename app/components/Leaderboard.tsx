"use client";

import { useEffect, useState } from "react";

type LeaderBoardData = { 
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
};

type SortColumn = 'player' | 'wins' | 'losses' | 'winPct' | 'form' | 'currentStreak' | 'bestStreak' | 'worstStreak' | 'fines' | 'homeWinPct' | 'awayWinPct' | 'bttsPct' | 'o2GoalsPct';
type SortDirection = 'asc' | 'desc';

export default function Leaderboard({ selectedPlayer }: { selectedPlayer?: string }) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderBoardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('winPct');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedData = () => {
    const sorted = [...leaderboardData].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortColumn) {
        case 'player':
          aValue = a.user.toLowerCase();
          bValue = b.user.toLowerCase();
          break;
        case 'wins':
          aValue = a.wins;
          bValue = b.wins;
          break;
        case 'losses':
          aValue = a.losses;
          bValue = b.losses;
          break;
        case 'winPct':
          aValue = parseFloat(a.winPct);
          bValue = parseFloat(b.winPct);
          break;
        case 'form':
          // Count wins in last 5 results
          aValue = (a.form || '').split('').filter(r => r === 'W').length;
          bValue = (b.form || '').split('').filter(r => r === 'W').length;
          break;
        case 'currentStreak':
          aValue = a.currentStreak;
          bValue = b.currentStreak;
          break;
        case 'bestStreak':
          aValue = a.longestWinStreak;
          bValue = b.longestWinStreak;
          break;
        case 'worstStreak':
          aValue = a.longestLossStreak;
          bValue = b.longestLossStreak;
          break;
        case 'fines':
          aValue = a.fineTotal;
          bValue = b.fineTotal;
          break;
        case 'homeWinPct':
          aValue = parseFloat(a.homeWinPct);
          bValue = parseFloat(b.homeWinPct);
          break;
        case 'awayWinPct':
          aValue = parseFloat(a.awayWinPct);
          bValue = parseFloat(b.awayWinPct);
          break;
        case 'bttsPct':
          aValue = parseFloat(a.bttsPct);
          bValue = parseFloat(b.bttsPct);
          break;
        case 'o2GoalsPct':
          aValue = parseFloat(a.o2GoalsPct);
          bValue = parseFloat(b.o2GoalsPct);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <span className="opacity-30">↕️</span>;
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const res = await fetch("/api/picks");
        const users = await res.json();
        setLeaderboardData(users);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred');
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-gradient-to-r from-slate-700 to-slate-600 border-b border-slate-600">
              <th className="sticky left-0 z-20 px-1 md:px-2 py-2 md:py-4 text-left text-xs md:text-sm font-semibold text-slate-200 bg-slate-700">Rank</th>
              <th 
                onClick={() => handleSort('player')}
                className="sticky left-[32px] md:left-[48px] z-10 px-2 md:px-6 py-2 md:py-4 text-left text-xs md:text-sm font-semibold text-slate-200 bg-slate-700 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  Player <SortIcon column="player" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('winPct')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Win Rate <SortIcon column="winPct" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('form')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Form <SortIcon column="form" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('wins')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Wins <SortIcon column="wins" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('losses')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Losses <SortIcon column="losses" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('currentStreak')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Current Streak <SortIcon column="currentStreak" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('bestStreak')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Best Streak <SortIcon column="bestStreak" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('worstStreak')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Worst Streak <SortIcon column="worstStreak" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('fines')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Fines (£) <SortIcon column="fines" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('homeWinPct')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Home Win Pick % <SortIcon column="homeWinPct" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('awayWinPct')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  Away Win Pick % <SortIcon column="awayWinPct" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('bttsPct')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  BTTS Pick % <SortIcon column="bttsPct" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('o2GoalsPct')}
                className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  O2.5 Goals Pick % <SortIcon column="o2GoalsPct" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {getSortedData()
              .map((u, index) => (
                <tr
                  key={u.user}
                  className={`border-b border-slate-700 transition-colors ${
                    index % 2 === 0 ? "bg-slate-800" : "bg-slate-750"
                  } hover:bg-slate-700 ${
                    u.user === selectedPlayer ? "border-l-4 border-l-yellow-400" : ""
                  }`}
                >
                  <td className="sticky left-0 z-20 px-1 md:px-2 py-2 md:py-4 text-xs md:text-sm font-bold text-yellow-400 bg-slate-800">
                    {index === 0 && "🥇"}
                    {index === 1 && "🥈"}
                    {index === 2 && "🥉"}
                    {index === 5 && "💩"}
                    {index > 2 && index !== 5 && `${index + 1}.`}
                  </td>
                  <td className="sticky left-[32px] md:left-[48px] z-10 px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm font-medium text-white bg-slate-800">{u.user}</td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center font-bold">
                    <span className={`${getWinRateColor(u.winPct)} text-white px-3 py-1 rounded-full text-xs`}>
                      {u.winPct}%
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {(u.form || '-').split('').map((result, idx) => (
                        <div
                          key={idx}
                          className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center ${
                            result === 'W' ? 'bg-green-600' : result === 'L' ? 'bg-red-600' : 'bg-slate-600'
                          }`}
                        >
                          <span className="text-white font-bold text-[10px] md:text-xs leading-none">
                            {result}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center text-green-400 font-semibold">{u.wins}</td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center text-red-400 font-semibold">{u.losses}</td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center">
                    <span className={`${u.currentStreak > 0 ? 'bg-green-600' : 'bg-red-600'} text-white px-2 md:px-3 py-1 rounded-full text-xs font-bold`}>
                      {(u.currentStreak > 0 ? '🔥' : '💀') + Math.abs(u.currentStreak)}
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center">
                    <span className="bg-green-600 text-white px-2 md:px-3 py-1 rounded-full text-xs font-bold">
                      🔥 {u.longestWinStreak}
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center">
                    <span className="bg-red-600 text-white px-2 md:px-3 py-1 rounded-full text-xs font-bold">
                      💀 {u.longestLossStreak}
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center">
                    <span className="bg-amber-600 text-white px-2 md:px-3 py-1 rounded-full text-xs font-bold">
                      £{u.fineTotal}
                    </span>
                    <div className="text-[10px] md:text-[11px] text-amber-200 mt-1">{u.fineCount} hits</div>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center">
                    <span className="inline-flex items-center gap-1 bg-blue-600 text-white px-1.5 md:px-2.5 py-1 rounded text-xs font-semibold border border-blue-400">
                      <span>🏠</span>
                      <span>{u.homeWinPct}%</span>
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center">
                    <span className="inline-flex items-center gap-1 bg-indigo-600 text-white px-1.5 md:px-2.5 py-1 rounded text-xs font-semibold border border-indigo-400">
                      <span>✈️</span>
                      <span>{u.awayWinPct}%</span>
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center">
                    <span className="inline-flex items-center gap-1 bg-purple-600 text-white px-1.5 md:px-2.5 py-1 rounded text-xs font-semibold border border-purple-400">
                      <span>⚽️</span>
                      <span>{u.bttsPct}%</span>
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-center">
                    <span className="inline-flex items-center gap-1 bg-pink-600 text-white px-1.5 md:px-2.5 py-1 rounded text-xs font-semibold border border-pink-400">
                      <span>🎯</span>
                      <span>{u.o2GoalsPct}%</span>
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
