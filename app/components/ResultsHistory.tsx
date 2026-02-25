"use client";

import { useEffect, useRef, useState } from "react";
import OddsModal from "./OddsModal";

type PlayerResults = {
  username: string;
  results: Array<{
    outcome: "W" | "L" | "P";
    emoji: string | null;
    prediction?: {
      type: string;
      match: {
        homeName: string;
        awayName: string;
        startDateTimeUtc: string;
        eventId: string;
      };
    };
  }>;
};

export default function ResultsHistory({
  selectedPlayer,
}: {
  selectedPlayer?: string;
}) {
  const [players, setPlayers] = useState<PlayerResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [removing, setRemoving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [betStatus, setBetStatus] = useState<{
    week: number;
    placedBy: string;
  } | null>(null);
  const [markingBet, setMarkingBet] = useState(false);
  const [manualSettling, setManualSettling] = useState(false);
  const [resultDetail, setResultDetail] = useState<{
    username: string;
    outcome: "W" | "L";
    type?: string;
    match?: {
      homeName: string;
      awayName: string;
      startDateTimeUtc: string;
      eventId: string;
    };
    finalScore?: { home: number | null; away: number | null };
  } | null>(null);
  const [fetchingScore, setFetchingScore] = useState(false);
  const [oddsModalRound, setOddsModalRound] = useState<number | null>(null);

  const handleRemovePrediction = async (
    username: string,
    resultIndex: number,
  ) => {
    if (!confirm("Remove this prediction?")) return;

    setRemoving(true);
    try {
      const res = await fetch("/api/predictions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, resultIndex }),
      });

      if (!res.ok) {
        throw new Error("Failed to remove prediction");
      }

      // Reload the page to refresh results
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove prediction");
      setRemoving(false);
    }
  };

  const handleMarkBetPlaced = async () => {
    if (!selectedPlayer) return;

    setMarkingBet(true);
    try {
      const res = await fetch("/api/bet-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedPlayer,
          week: maxResults,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to mark bet as placed");
      }

      // Update local state
      const newStatus = { week: maxResults, placedBy: selectedPlayer };
      setBetStatus(newStatus);

      // Dispatch custom event to notify other components
      window.dispatchEvent(
        new CustomEvent("betStatusUpdated", {
          detail: newStatus,
        }),
      );
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to mark bet as placed",
      );
    } finally {
      setMarkingBet(false);
    }
  };

  const handleManualSettle = async () => {
    if (
      !confirm("Are you sure you want to manually settle all pending results?")
    )
      return;

    setManualSettling(true);
    try {
      console.log("Manually settling results...");
      const res = await fetch("/api/results", { method: "POST" });

      if (!res.ok) {
        throw new Error("Failed to settle results");
      }

      console.log("Results settled successfully");
      // Refresh players data
      const raw = await fetch("/api/picks/raw");
      const data = await raw.json();
      setPlayers(data);

      alert("Results updated successfully!");
    } catch (err) {
      console.error("Error settling results:", err);
      alert(err instanceof Error ? err.message : "Failed to settle results");
    } finally {
      setManualSettling(false);
    }
  };

  useEffect(() => {
    const loadResults = async () => {
      try {
        const res = await fetch("/api/picks/raw");
        const data = await res.json();
        setPlayers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    const loadBetStatus = async () => {
      try {
        const res = await fetch("/api/bet-status");
        const data = await res.json();
        setBetStatus(data.status);
      } catch (err) {
        console.error("Failed to load bet status:", err);
      }
    };

    loadResults();
    loadBetStatus();

    // Listen for bet status updates from other components
    const handleBetStatusUpdate = (event: CustomEvent) => {
      setBetStatus(event.detail);
    };

    window.addEventListener(
      "betStatusUpdated",
      handleBetStatusUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        "betStatusUpdated",
        handleBetStatusUpdate as EventListener,
      );
    };
  }, []);

  // Auto-settle: settle results 135 minutes after the latest game starts
  useEffect(() => {
    if (!players.length) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let isActive = true;

    const settleResults = async () => {
      if (!isActive) return;

      try {
        console.log("Settling results 135 minutes after latest kickoff...");
        const settleRes = await fetch("/api/results", { method: "POST" });
        if (settleRes.ok) {
          console.log("Results settled successfully");
          // Refresh players in state
          const refreshRes = await fetch("/api/picks/raw");
          const refreshData = await refreshRes.json();
          setPlayers(refreshData);
        } else {
          console.error("Failed to settle results:", settleRes.status);
        }
      } catch (err) {
        console.error("Error settling results:", err);
      }
    };

    const scheduleSettle = async () => {
      if (!isActive) return;

      // Get fresh data to check
      const res = await fetch("/api/picks/raw");
      const data = await res.json();

      // Count total pending predictions
      const pendingCount = data.filter((p: PlayerResults) =>
        p.results.some((r) => r.outcome === "P"),
      ).length;

      if (pendingCount === 0) return; // No pending results

      // Gather pending predictions with kickoff times
      const pending: Array<Date> = [];
      data.forEach((p: PlayerResults) => {
        const pr = p.results.find(
          (r) => r.outcome === "P" && r.prediction?.match?.startDateTimeUtc,
        );
        if (pr) pending.push(new Date(pr.prediction!.match.startDateTimeUtc));
      });

      if (!pending.length) return; // No pending results with dates

      const latestKickoff = new Date(
        Math.max(...pending.map((d) => d.getTime())),
      );
      const settleTime = new Date(latestKickoff.getTime() + 135 * 60 * 1000); // 135 minutes after kickoff
      const now = new Date();
      const msUntilSettle = settleTime.getTime() - now.getTime();

      if (msUntilSettle <= 0) {
        // Time has already passed, settle immediately
        console.log(
          "Latest game started more than 135 minutes ago, settling now...",
        );
        await settleResults();
      } else {
        // Schedule settlement for the future
        console.log(
          `Scheduling auto-settle for ${settleTime.toLocaleString()} (in ${Math.round(msUntilSettle / 60000)} minutes)`,
        );
        timeoutId = setTimeout(settleResults, msUntilSettle);
      }
    };

    scheduleSettle();

    // Cleanup timeout on unmount
    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, []); // Remove players dependency to prevent infinite loop

  // Fetch match score from results API on demand
  useEffect(() => {
    const fetchScore = async () => {
      if (!resultDetail?.match?.eventId || resultDetail.finalScore) return;
      setFetchingScore(true);
      try {
        const res = await fetch("/api/results");
        const results: Array<{
          eventId?: string;
          id?: string;
          homeScoreFt?: number | string;
          awayScoreFt?: number | string;
          homeScore?: number | string;
          awayScore?: number | string;
          home_score?: number | string;
          away_score?: number | string;
          home?: number | string;
          away?: number | string;
        }> = await res.json();
        const match = results.find(
          (r) =>
            String(r.eventId || r.id) === String(resultDetail.match!.eventId),
        );
        if (match) {
          // Extract score from common fields
          const fields = [
            ["homeScoreFt", "awayScoreFt"],
            ["homeScore", "awayScore"],
            ["home_score", "away_score"],
            ["home", "away"],
          ];
          let home: number | null = null;
          let away: number | null = null;
          for (const [h, a] of fields) {
            const hv = match[h];
            const av = match[a];
            if (
              hv !== undefined &&
              hv !== null &&
              av !== undefined &&
              av !== null
            ) {
              home = typeof hv === "string" ? parseInt(hv, 10) : hv;
              away = typeof av === "string" ? parseInt(av, 10) : av;
              break;
            }
          }
          if (home !== null && away !== null) {
            setResultDetail((prev) =>
              prev ? { ...prev, finalScore: { home, away } } : null,
            );
          }
        }
      } catch (err) {
        console.error("Failed to fetch score:", err);
      } finally {
        setFetchingScore(false);
      }
    };
    fetchScore();
  }, [resultDetail?.match?.eventId, resultDetail?.finalScore]);

  // After data loads, auto-scroll to the latest week (rightmost)
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const el = scrollRef.current;
      requestAnimationFrame(() => {
        el.scrollLeft = el.scrollWidth;
      });
    }
  }, [loading]);

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xl text-slate-300">Loading results…</p>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xl text-red-400">Error: {error}</p>
      </div>
    );

  const maxResults = Math.max(...players.map((p) => p.results.length));
  const totalWeeks = maxResults + 1; // include upcoming week column

  // Fixed turn order repeating each week
  const turnOrder = [
    "Brett",
    "Andy Barky",
    "The Real Barky",
    "Hudo",
    "Gaz",
    "Clarky",
  ];
  const turnForWeek = (weekIndex: number) =>
    turnOrder[weekIndex % turnOrder.length];

  // Determine which rounds everyone won
  const allWinRounds = new Set<number>();
  for (let i = 0; i < maxResults; i++) {
    const allWon = players.every(
      (player) => player.results[i] && player.results[i].outcome === "W",
    );
    if (allWon) {
      allWinRounds.add(i);
    }
  }

  // Get all pending predictions
  const pendingPredictions = players
    .map((player) => ({
      username: player.username,
      prediction: player.results.find((r) => r.outcome === "P"),
    }))
    .filter((p) => p.prediction);

  const mostPickedTeams = players.flatMap((player) =>
    player.results
      .filter(
        (r) =>
          r.prediction &&
          r.prediction.match != null &&
          (r.prediction.type === "Home" || r.prediction.type === "Away"),
      )
      .map((result) => ({
        team:
          result.prediction!.type === "Home"
            ? result.prediction!.match.homeName
            : result.prediction!.match.awayName,
      })),
  );
  const teamCounts = mostPickedTeams.reduce(
    (acc, { team }) => {
      acc[team] = (acc[team] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const topThreeTeams = Object.entries(teamCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([team]) => team);

  // Fine ledger: £5 for each of these emojis
  const finePattern = /(😴|🤢|🤣|🤦‍♂️|😡)/g;
  const fineRows = players.map((player) => {
    let matches = 0;
    player.results.forEach((r) => {
      if (r.emoji) {
        const hits = r.emoji.match(finePattern);
        matches += hits ? hits.length : 0;
      }
    });
    return {
      user: player.username,
      count: matches,
      total: matches * 5,
    };
  });
  const anyFines = fineRows.some((r) => r.count > 0);

  // Find the first round that's incomplete (doesn't have all W/L results)
  let turnRoundIndex = maxResults; // default to next round
  for (let i = 0; i < maxResults; i++) {
    const isComplete = players.every(
      (player) =>
        player.results[i] &&
        (player.results[i].outcome === "W" ||
          player.results[i].outcome === "L"),
    );
    if (!isComplete) {
      turnRoundIndex = i;
      break;
    }
  }

  const currentWeek = maxResults;
  const nextPlayer = turnForWeek(turnRoundIndex);
  const isMyTurn = nextPlayer === selectedPlayer;
  const betPlaced = betStatus?.placedBy;

  // Only enable bet placement when everyone has a pending prediction for this round
  const allPredictionsInRound = players.every(
    (player) =>
      player.results[turnRoundIndex] &&
      player.results[turnRoundIndex].outcome === "P",
  );

  return (
    <div className="mb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-4xl font-bold text-white flex items-center gap-2">
          <span className="text-purple-400">📊</span> Results History
        </h2>

        {pendingPredictions.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Status pill */}
            {betPlaced ? (
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 shadow shadow-emerald-900/50">
                <span className="text-lg">✅</span>
                <div className="leading-tight">
                  <div className="text-white font-semibold">Bet placed</div>
                  <div className="text-emerald-100 text-xs">By {betPlaced}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/90 to-orange-600/90 shadow shadow-orange-900/40 border border-orange-300/40">
                <span className="text-lg">⏳</span>
                <div className="leading-tight">
                  <div className="text-white font-semibold">
                    {nextPlayer}&apos;s bet...
                  </div>
                  <div className="text-amber-100 text-xs">
                    {allPredictionsInRound
                      ? "Ready to place"
                      : "Need all predictions"}
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {isMyTurn && !betPlaced && (
                <button
                  onClick={handleMarkBetPlaced}
                  disabled={markingBet || !allPredictionsInRound}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow shadow-emerald-900/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Set Bet as placed
                </button>
              )}
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow shadow-purple-900/40 transition"
              >
                See all selections
              </button>
            </div>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="bg-slate-800 rounded-lg shadow-lg overflow-x-auto border border-slate-700"
      >
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-700 to-slate-600 border-b border-slate-600">
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200 sticky left-0 z-40 bg-slate-700">
                Player
              </th>
              {Array.from({ length: totalWeeks }, (_, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 text-center text-xs font-semibold min-w-[60px] ${
                    i < maxResults && allWinRounds.has(i)
                      ? "bg-yellow-600 text-yellow-100"
                      : "text-slate-200"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{i + 1}</span>
                    {selectedPlayer === "The Real Barky" && i < maxResults && (
                      <button
                        onClick={() => setOddsModalRound(i + 1)}
                        className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] rounded transition-colors"
                        title="Enter odds for this round"
                      >
                        💰
                      </button>
                    )}
                  </div>
                  {i + 1}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-700 bg-slate-750">
              <th className="px-6 py-2 text-left text-xs font-semibold text-slate-200 sticky left-0 z-30 bg-slate-800">
                Turn
              </th>
              {Array.from({ length: totalWeeks }, (_, i) => (
                <th
                  key={`turn-${i}`}
                  className={`px-3 py-2 text-center text-xs font-semibold ${
                    i === maxResults ? "text-slate-200" : "text-yellow-200"
                  }`}
                >
                  {turnForWeek(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player, playerIndex) => (
              <tr
                key={player.username}
                className={`border-b border-slate-700 transition-colors ${
                  playerIndex % 2 === 0 ? "bg-slate-800" : "bg-slate-750"
                } hover:bg-slate-700 ${
                  player.username === selectedPlayer
                    ? "border-l-4 border-l-yellow-400"
                    : ""
                }`}
              >
                <td
                  className={`px-2 py-2 md:px-6 md:py-4 text-xs md:text-sm font-medium text-white sticky left-0 z-20 bg-slate-800`}
                >
                  {player.username}
                </td>
                {Array.from({ length: totalWeeks }, (_, i) => (
                  <td
                    key={i}
                    className={`px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-sm ${
                      i < maxResults && allWinRounds.has(i)
                        ? "bg-yellow-600 bg-opacity-20"
                        : ""
                    }`}
                  >
                    {i >= player.results.length ? (
                      <span className="text-slate-600">-</span>
                    ) : player.results[i] ? (
                      <div className="relative inline-flex items-center justify-center">
                        <span
                          onClick={() => {
                            const r = player.results[i];
                            if (
                              (r.outcome === "W" || r.outcome === "L") &&
                              r.prediction
                            ) {
                              setResultDetail({
                                username: player.username,
                                outcome: r.outcome,
                                type: r.prediction.type,
                                match: r.prediction.match,
                                finalScore: (r as any).prediction?.finalScore,
                              });
                            }
                          }}
                          className={`inline-flex items-center justify-center w-7 h-7 md:w-10 md:h-10 rounded-full font-bold text-xs md:text-sm ${
                            player.results[i].outcome === "W"
                              ? "bg-green-600 text-white"
                              : player.results[i].outcome === "L"
                                ? "bg-red-600 text-white"
                                : "bg-blue-600 text-white"
                          } ${player.results[i].prediction && (player.results[i].outcome === "W" || player.results[i].outcome === "L") ? "cursor-pointer ring-0 hover:ring-2 hover:ring-offset-2 hover:ring-offset-slate-800 hover:ring-white/40" : ""}`}
                          title={
                            player.results[i].outcome === "P" &&
                            player.results[i].prediction
                              ? `${player.results[i].prediction?.type}: ${player.results[i].prediction?.match.homeName} vs ${player.results[i].prediction?.match.awayName}`
                              : undefined
                          }
                        >
                          {player.results[i].outcome}
                        </span>
                        {player.results[i].emoji &&
                          (() => {
                            const emoji = player.results[i].emoji || "";
                            const chars = emoji
                              .split(/(?=[\p{Emoji_Presentation}])/u)
                              .filter((c) => /[\p{Emoji}]/u.test(c));
                            const positions = [
                              "-top-2 -left-2",
                              "-top-2 -right-2",
                              "-bottom-2 -left-2",
                              "-bottom-2 -right-2",
                            ];
                            return chars.slice(0, 4).map((ch, idx) => (
                              <span
                                key={idx}
                                className={`absolute ${positions[idx]} text-lg leading-none pointer-events-none`}
                              >
                                {ch}
                              </span>
                            ));
                          })()}
                        {player.results[i].outcome === "P" &&
                          player.username === selectedPlayer &&
                          !betStatus && (
                            <button
                              onClick={() =>
                                handleRemovePrediction(player.username, i)
                              }
                              disabled={removing}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove prediction"
                            >
                              −
                            </button>
                          )}
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Emoji Key */}
      <div className="mt-6 bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Streak Emojis */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
              Streak Indicators
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <span className="text-slate-200 text-sm">3 win streak</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔥🔥</span>
                <span className="text-slate-200 text-sm">6 win streak</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔥🔥🔥</span>
                <span className="text-slate-200 text-sm">
                  9 win streak (adds 🔥 every 3 wins)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">😡</span>
                <span className="text-slate-200 text-sm">
                  3+ loss streak (adds 😡 every 3 losses)
                </span>
              </div>
            </div>
          </div>

          {/* Fine Emojis */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
              Fine Emojis (£5 each)
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">😴</span>
                <span className="text-slate-200 text-sm">BTTS/O2.5 0-0</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤢</span>
                <span className="text-slate-200 text-sm">Only loser</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤣</span>
                <span className="text-slate-200 text-sm">3+ goals loss</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤦‍♂️</span>
                <span className="text-slate-200 text-sm">U2.5 goal fest</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Winnings Table */}
      <div className="mt-6">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-green-400">💰</span> Winnings
        </h3>
        <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-700 to-slate-600 border-b border-slate-600">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">
                  Week
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-200">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-800 hover:bg-slate-700 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-white">
                  Week 22
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    £337
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Most Picked Teams */}
      {topThreeTeams.length > 0 && (
        <div className="mt-6">
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-blue-400">⭐</span> Most Picked Teams
          </h3>
          <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-700 to-slate-600 border-b border-slate-600">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">
                    Team
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-200">
                    Picks
                  </th>
                </tr>
              </thead>
              <tbody>
                {topThreeTeams.map((team, index) => (
                  <tr
                    key={team}
                    className={`border-b border-slate-700 last:border-0 ${
                      index % 2 === 0 ? "bg-slate-800" : "bg-slate-750"
                    } hover:bg-slate-700 transition-colors`}
                  >
                    <td className="px-6 py-4 text-sm font-bold text-yellow-400">
                      {index === 0 && "🥇"}
                      {index === 1 && "🥈"}
                      {index === 2 && "🥉"}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-white">
                      {team}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        {teamCounts[team]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for showing all selections */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-slate-800 rounded-lg shadow-2xl max-w-md w-full border-2 border-purple-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Betslip Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  🎟️ Bet Slip
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <p className="text-purple-100 text-sm mt-1">
                Upcoming Round Selections
              </p>
            </div>

            {/* Betslip Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {pendingPredictions.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  No selections yet
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingPredictions.map((item, index) => (
                    <div
                      key={index}
                      className="bg-slate-700 border border-slate-600 rounded-lg p-4 hover:border-purple-500 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-white text-lg">
                          {item.username}
                        </span>
                        <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
                          {item.prediction?.prediction?.type}
                        </span>
                      </div>
                      {item.prediction?.prediction?.match && (
                        <div className="text-sm text-slate-300">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">
                              {item.prediction.prediction.match.homeName}
                            </span>
                            <span className="text-slate-500">vs</span>
                            <span className="font-semibold">
                              {item.prediction.prediction.match.awayName}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {new Date(
                              item.prediction.prediction.match.startDateTimeUtc,
                            ).toLocaleString("en-GB", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Betslip Footer */}
            <div className="bg-slate-900 px-6 py-4 rounded-b-lg border-t border-slate-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total Selections</span>
                <span className="text-white font-bold text-lg">
                  {pendingPredictions.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for result details */}
      {resultDetail && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setResultDetail(null)}
        >
          <div
            className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-md border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-6 py-4 rounded-t-lg ${resultDetail.outcome === "W" ? "bg-green-700" : "bg-red-700"}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {resultDetail.outcome === "W" ? "✅ Win" : "❌ Loss"} •{" "}
                  {resultDetail.username}
                </h3>
                <button
                  onClick={() => setResultDetail(null)}
                  className="text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {resultDetail.match && (
                <>
                  <div className="text-center">
                    <div className="text-white font-semibold text-base mb-1">
                      {resultDetail.match.homeName}{" "}
                      <span className="text-slate-400">vs</span>{" "}
                      {resultDetail.match.awayName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(
                        resultDetail.match.startDateTimeUtc,
                      ).toLocaleString("en-GB", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {resultDetail.finalScore && (
                    <div className="bg-slate-700 rounded-lg p-4 text-center">
                      <div className="text-slate-300 text-xs uppercase tracking-wide mb-2">
                        Final Score
                      </div>
                      <div className="text-white text-3xl font-bold">
                        {resultDetail.finalScore.home ?? "-"}{" "}
                        <span className="text-slate-400 text-lg">-</span>{" "}
                        {resultDetail.finalScore.away ?? "-"}
                      </div>
                    </div>
                  )}
                  {!resultDetail.finalScore && (
                    <div className="bg-slate-700 rounded-lg p-4 text-center">
                      <div className="text-slate-300 text-xs uppercase tracking-wide mb-2">
                        Final Score
                      </div>
                      <div className="text-slate-400 text-sm">
                        {fetchingScore ? "Loading..." : "Score unavailable"}
                      </div>
                    </div>
                  )}
                </>
              )}
              {typeof resultDetail.type === "string" && (
                <div className="text-slate-200 text-sm">
                  <span className="text-slate-400">Your pick:</span>{" "}
                  <span className="font-semibold text-white">
                    {resultDetail.type}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Settle Button - Only for The Real Barky */}
      {selectedPlayer === "The Real Barky" && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleManualSettle}
            disabled={manualSettling}
            className="px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {manualSettling
              ? "Updating Results..."
              : "⚡ Manual Settle Results"}
          </button>
        </div>
      )}

      {/* Odds Modal */}
      <OddsModal
        isOpen={oddsModalRound !== null}
        onClose={() => setOddsModalRound(null)}
        roundNumber={oddsModalRound || 1}
      />
    </div>
  );
}
