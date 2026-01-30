"use client";

import { useEffect, useState } from "react";

type Pick = {
  username: string;
  outcome: "W" | "L" | "P";
  prediction: {
    prediction: {
      type: string;
      match: {
        homeName: string;
        awayName: string;
        startDateTimeUtc: string;
        eventId: string;
      };
      finalScore?: {
        home: number | null;
        away: number | null;
      };
    };
  } | null;
};

export default function AllPicksBanner({
  selectedPlayer,
}: {
  selectedPlayer?: string;
}) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [isSettled, setIsSettled] = useState(false);
  const [betStatus, setBetStatus] = useState<{
    week: number;
    placedBy: string;
  } | null>(null);
  const [markingBet, setMarkingBet] = useState(false);

  const handleMarkBetPlaced = async () => {
    if (!selectedPlayer) return;

    setMarkingBet(true);
    try {
      const res = await fetch("/api/bet-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedPlayer,
          week: currentRound,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to mark bet as placed");
      }

      // Update local state
      const newStatus = { week: currentRound, placedBy: selectedPlayer };
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

  useEffect(() => {
    const loadPicks = async () => {
      try {
        const res = await fetch("/api/picks/raw");
        const data = await res.json();

        // Calculate the current round number (max results length)
        const maxResults = Math.max(...data.map((u: any) => u.results.length));

        // Check if all players have the same number of results (all on same round)
        const allOnSameRound = data.every(
          (u: any) => u.results.length === maxResults,
        );

        if (!allOnSameRound) {
          // Players are on different rounds - don't show banner
          setShowBanner(false);
          setLoading(false);
          return;
        }

        setCurrentRound(maxResults);

        // Find all players' latest results (all from same round)
        const latestPicks: Pick[] = [];
        data.forEach((player: any) => {
          const lastResult = player.results[player.results.length - 1];
          if (lastResult && lastResult.prediction) {
            latestPicks.push({
              username: player.username,
              outcome: lastResult.outcome,
              prediction: lastResult,
            });
          }
        });

        // Check if all picks are settled (no pending)
        const allSettled =
          latestPicks.length === 6 &&
          latestPicks.every((p) => p.outcome !== "P");

        // Check if all picks are pending
        const allPending =
          latestPicks.length === 6 &&
          latestPicks.every((p) => p.outcome === "P");

        // Check if we have at least 6 picks (complete round)
        const hasCompleteRound = latestPicks.length === 6;

        if (hasCompleteRound) {
          // Check if within 24 hour window from latest kickoff
          const kickoffTimes = latestPicks
            .map((p) => p.prediction?.prediction?.match?.startDateTimeUtc)
            .filter(Boolean)
            .map((time) => new Date(time!));

          if (kickoffTimes.length > 0) {
            const latestKickoff = new Date(
              Math.max(...kickoffTimes.map((d) => d.getTime())),
            );
            const now = new Date();
            const hoursSinceKickoff =
              (now.getTime() - latestKickoff.getTime()) / (1000 * 60 * 60);

            // Show banner if all pending OR within 24 hours of latest kickoff
            if (allPending || hoursSinceKickoff <= 24) {
              setPicks(latestPicks);
              setIsSettled(allSettled);
              setShowBanner(true);
            } else {
              setShowBanner(false);
            }
          } else {
            setShowBanner(false);
          }
        } else {
          setShowBanner(false);
        }
      } catch (err) {
        console.error("Failed to load picks:", err);
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

    loadPicks();
    loadBetStatus();

    // Listen for bet status updates from other components
    const handleBetStatusUpdate = (event: CustomEvent) => {
      setBetStatus(event.detail);
    };

    window.addEventListener(
      "betStatusUpdated",
      handleBetStatusUpdate as EventListener,
    );

    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      loadPicks();
      loadBetStatus();
    }, 30000);

    return () => {
      clearInterval(interval);
      window.removeEventListener(
        "betStatusUpdated",
        handleBetStatusUpdate as EventListener,
      );
    };
  }, []);

  if (loading || !showBanner) return null;

  const hasMixedResults =
    picks.some((p) => p.outcome === "P") &&
    picks.some((p) => p.outcome !== "P");
  const pendingCount = picks.filter((p) => p.outcome === "P").length;
  const settledCount = picks.filter((p) => p.outcome !== "P").length;
  const allPending = picks.every((p) => p.outcome === "P");

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
    turnOrder[(weekIndex - 1) % turnOrder.length];
  const nextPlayer = turnForWeek(currentRound);
  const isMyTurn = nextPlayer === selectedPlayer;
  const betPlaced = betStatus?.placedBy;

  return (
    <div className="mb-8">
      <div className="bg-slate-800 rounded-lg shadow-xl border-2 border-purple-500 overflow-hidden">
        {/* Header */}
        <div
          className={`px-6 py-4 ${
            isSettled
              ? "bg-gradient-to-r from-slate-600 to-slate-700"
              : hasMixedResults
                ? "bg-gradient-to-r from-indigo-600 to-purple-700"
                : "bg-gradient-to-r from-purple-600 to-purple-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              {isSettled ? "📊" : hasMixedResults ? "⏱️" : "🎟️"} Round{" "}
              {currentRound}{" "}
              {isSettled ? "Results" : hasMixedResults ? "Live" : "Picks"}
            </h3>
            <div
              className={`px-3 py-1 rounded-full ${
                isSettled
                  ? "bg-slate-800"
                  : hasMixedResults
                    ? "bg-indigo-800"
                    : "bg-purple-800"
              }`}
            >
              <span className="text-white font-bold text-sm">
                {hasMixedResults
                  ? `${settledCount}/${picks.length}`
                  : `${picks.length}/6`}
              </span>
            </div>
          </div>
          <p className="text-purple-100 text-sm mt-1">
            {isSettled
              ? ""
              : hasMixedResults
                ? `${settledCount} settled • ${pendingCount} pending`
                : ""}
          </p>
        </div>

        {/* Bet Status Banner - only show when all picks are pending */}
        {allPending && (
          <div className="px-6 py-4 bg-slate-750 border-b border-slate-700">
            <div className="flex items-center justify-between gap-3">
              {/* Status pill */}
              {betPlaced ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 shadow shadow-emerald-900/50">
                  <span className="text-base">✅</span>
                  <div className="leading-tight">
                    <div className="text-white font-semibold text-sm">
                      Bet placed
                    </div>
                    <div className="text-emerald-100 text-xs">
                      By {betPlaced}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/90 to-orange-600/90 shadow shadow-orange-900/40 border border-orange-300/40">
                  <span className="text-base">⏳</span>
                  <div className="leading-tight">
                    <div className="text-white font-semibold text-sm">
                      {nextPlayer}&apos;s bet...
                    </div>
                  </div>
                </div>
              )}

              {/* Action button */}
              {isMyTurn && !betPlaced && (
                <button
                  onClick={handleMarkBetPlaced}
                  disabled={markingBet}
                  className="px-3 py-2 sm:px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm sm:text-base shadow shadow-emerald-900/40 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {markingBet ? "Marking..." : "Set Bet as placed"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Picks Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {picks.map((item, index) => (
              <div
                key={index}
                className={`border-2 rounded-lg p-4 transition-all ${
                  item.outcome === "P"
                    ? "bg-slate-800 border-purple-500/30 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20"
                    : item.outcome === "W"
                      ? "bg-green-900/30 border-green-500/50 hover:border-green-500 hover:shadow-lg hover:shadow-green-500/20"
                      : "bg-red-900/30 border-red-500/50 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-white text-lg">
                    {item.username}
                  </span>
                  <div className="flex items-center gap-2">
                    {item.outcome !== "P" && (
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          item.outcome === "W"
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                        }`}
                      >
                        {item.outcome}
                      </span>
                    )}
                    <span
                      className={`px-3 py-1 text-white text-xs font-bold rounded-full ${
                        item.outcome === "P"
                          ? "bg-purple-600"
                          : item.outcome === "W"
                            ? "bg-green-600"
                            : "bg-red-600"
                      }`}
                    >
                      {item.prediction?.prediction?.type}
                    </span>
                  </div>
                </div>
                {item.prediction?.prediction?.match && (
                  <div className="text-sm text-slate-300">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white">
                        {item.prediction.prediction.match.homeName}
                      </span>
                      <span className="text-slate-500 font-bold">vs</span>
                      <span className="font-semibold text-white">
                        {item.prediction.prediction.match.awayName}
                      </span>
                    </div>
                    {item.outcome !== "P" &&
                      item.prediction.prediction.finalScore &&
                      (item.prediction.prediction.finalScore.home !== null ||
                        item.prediction.prediction.finalScore.away !==
                          null) && (
                        <div className="bg-slate-900/50 rounded px-3 py-2 mb-2 text-center">
                          <div className="text-xs text-slate-400 mb-1">
                            Final Score
                          </div>
                          <div className="text-white text-lg font-bold">
                            {item.prediction.prediction.finalScore.home ?? "-"}{" "}
                            <span className="text-slate-500">-</span>{" "}
                            {item.prediction.prediction.finalScore.away ?? "-"}
                          </div>
                        </div>
                      )}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>📅</span>
                      <span>
                        {new Date(
                          item.prediction.prediction.match.startDateTimeUtc,
                        ).toLocaleString("en-GB", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
