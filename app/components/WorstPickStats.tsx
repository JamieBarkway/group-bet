"use client";

import { useEffect, useState } from "react";

type WorstPickPlayerStats = {
  user: string;
  votedWorstCount: number;
  lostAsWorst: number;
  wonAsWorst: number;
  votesReceived: number;
  mostVotedFor: string | null;
  mostVotedForCount: number;
};

type SortColumn =
  | "player"
  | "votedWorstCount"
  | "lostAsWorst"
  | "wonAsWorst"
  | "votesReceived";

export default function WorstPickStats({
  selectedPlayer,
}: {
  selectedPlayer?: string;
}) {
  const [stats, setStats] = useState<WorstPickPlayerStats[]>([]);
  const [fine, setFine] = useState(5);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>("votedWorstCount");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/worst-pick");
        const data = await res.json();
        setStats(data.stats || []);
        if (typeof data.fine === "number") setFine(data.fine);
      } catch {
        setStats([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sorted = [...stats].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;
    if (sortColumn === "player") {
      aValue = a.user.toLowerCase();
      bValue = b.user.toLowerCase();
    } else {
      aValue = a[sortColumn];
      bValue = b[sortColumn];
    }
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return a.user.localeCompare(b.user);
  });

  const SortIcon = ({ column }: { column: SortColumn }) =>
    sortColumn !== column ? (
      <span className="opacity-30">↕️</span>
    ) : sortDirection === "asc" ? (
      <span>↑</span>
    ) : (
      <span>↓</span>
    );

  if (loading || stats.length === 0) return null;

  const headerClass =
    "px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-600 transition-colors select-none";

  return (
    <div className="mb-12 -mt-8">
      <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <span>🗳️</span> Worst Pick Stats
      </h3>
      <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gradient-to-r from-slate-700 to-slate-600 border-b border-slate-600">
                <th
                  onClick={() => handleSort("player")}
                  className="sticky left-0 z-10 px-2 md:px-6 py-2 md:py-4 text-left text-xs md:text-sm font-semibold text-slate-200 bg-slate-700 cursor-pointer hover:bg-slate-600 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    Player <SortIcon column="player" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("votedWorstCount")}
                  className={headerClass}
                >
                  <div className="flex items-center justify-center gap-1">
                    Picked as Worst <SortIcon column="votedWorstCount" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("lostAsWorst")}
                  className={headerClass}
                >
                  <div className="flex items-center justify-center gap-1">
                    Lost as Worst <SortIcon column="lostAsWorst" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("wonAsWorst")}
                  className={headerClass}
                >
                  <div className="flex items-center justify-center gap-1">
                    Won as Worst <SortIcon column="wonAsWorst" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("votesReceived")}
                  className={headerClass}
                >
                  <div className="flex items-center justify-center gap-1">
                    Votes Received <SortIcon column="votesReceived" />
                  </div>
                </th>
                <th className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm font-semibold text-slate-200">
                  Votes Most For
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, index) => (
                <tr
                  key={s.user}
                  className={`border-b border-slate-700 transition-colors ${
                    index % 2 === 0 ? "bg-slate-800" : "bg-slate-750"
                  } hover:bg-slate-700 ${
                    s.user === selectedPlayer
                      ? "border-l-4 border-l-yellow-400"
                      : ""
                  }`}
                >
                  <td className="sticky left-0 z-10 px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm font-medium text-white bg-slate-800">
                    {s.user}
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-center">
                    <span className="bg-slate-600 text-white px-2 md:px-3 py-1 rounded-full text-xs font-bold">
                      💩 {s.votedWorstCount}
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-center">
                    <span className="bg-red-600 text-white px-2 md:px-3 py-1 rounded-full text-xs font-bold">
                      ❌ {s.lostAsWorst}
                    </span>
                    <div className="text-[10px] md:text-[11px] text-amber-200 mt-1">
                      £{s.lostAsWorst * fine}
                    </div>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-center">
                    <span className="bg-green-600 text-white px-2 md:px-3 py-1 rounded-full text-xs font-bold">
                      ✅ {s.wonAsWorst}
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-center">
                    <span className="bg-purple-600 text-white px-2 md:px-3 py-1 rounded text-xs font-semibold border border-purple-400">
                      {s.votesReceived}
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-center text-xs md:text-sm text-slate-200">
                    {s.mostVotedFor ? (
                      <>
                        <span className="font-semibold text-white">
                          {s.mostVotedFor}
                        </span>
                        <div className="text-[10px] md:text-[11px] text-slate-400 mt-1">
                          {s.mostVotedForCount}x
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
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
