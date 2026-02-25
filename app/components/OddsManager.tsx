"use client";

import { useEffect, useState } from "react";

type ResultWithPrediction = {
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
    finalScore?: {
      home: number;
      away: number;
    };
    odds?: number | string;
  };
};

type UserWithResults = {
  username: string;
  results: ResultWithPrediction[];
};

export default function OddsManager() {
  const [users, setUsers] = useState<UserWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await fetch("/api/picks/raw");
      const data = await res.json();
      setUsers(data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load data:", error);
      setLoading(false);
    }
  };

  const handleOddsChange = (
    username: string,
    resultIndex: number,
    value: string,
  ) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) => {
        if (user.username !== username) return user;
        return {
          ...user,
          results: user.results.map((result, idx) => {
            if (idx !== resultIndex) return result;
            return {
              ...result,
              prediction: result.prediction
                ? {
                    ...result.prediction,
                    odds: value || undefined,
                  }
                : undefined,
            };
          }),
        };
      }),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Convert string odds to numbers before saving
      const usersToSave = users.map((user) => ({
        ...user,
        results: user.results.map((result) => ({
          ...result,
          prediction: result.prediction
            ? {
                ...result.prediction,
                odds:
                  typeof result.prediction.odds === "string"
                    ? parseFloat(result.prediction.odds)
                    : result.prediction.odds,
              }
            : result.prediction,
        })),
      }));

      const res = await fetch("/api/odds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: usersToSave }),
      });

      if (!res.ok) {
        throw new Error("Failed to save odds");
      }

      setMessage("✅ Odds saved successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage("❌ Failed to save odds");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xl text-slate-300">Loading...</p>
      </div>
    );
  }

  // Get completed predictions (settled results with predictions)
  const completedPredictions = users.flatMap((user) =>
    user.results
      .map((result, idx) => ({
        user,
        result,
        resultIndex: idx,
      }))
      .filter(
        ({ result }) =>
          result.prediction &&
          (result.outcome === "W" || result.outcome === "L"),
      ),
  );

  // Group by round (result index)
  const byRound = completedPredictions.reduce(
    (acc, item) => {
      const round = item.resultIndex + 1;
      if (!acc[round]) acc[round] = [];
      acc[round].push(item);
      return acc;
    },
    {} as Record<number, typeof completedPredictions>,
  );

  const rounds = Object.keys(byRound)
    .map(Number)
    .sort((a, b) => b - a); // Most recent first

  const filteredRounds = selectedUser
    ? rounds.filter((round) =>
        byRound[round].some((item) => item.user.username === selectedUser),
      )
    : rounds;

  return (
    <div className="mb-12">
      <h2 className="text-4xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="text-blue-400">📊</span> Odds Manager
        <span className="text-sm font-normal text-slate-400 ml-2">
          (The Real Barky Only)
        </span>
      </h2>

      {message && (
        <div className="mb-4 p-4 bg-slate-700 border border-slate-600 rounded-lg">
          <p className="text-white text-center">{message}</p>
        </div>
      )}

      <div className="mb-6 flex gap-4 items-center">
        <label className="text-white font-medium">Filter by player:</label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Players</option>
          {users.map((user) => (
            <option key={user.username} value={user.username}>
              {user.username}
            </option>
          ))}
        </select>

        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
        >
          {saving ? "Saving..." : "💾 Save All Odds"}
        </button>
      </div>

      <div className="space-y-6">
        {filteredRounds.map((round) => {
          const roundPredictions = byRound[round];
          const hasAnyOdds = roundPredictions.some(
            (item) => item.result.prediction?.odds,
          );

          return (
            <div
              key={round}
              className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-6 py-3 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Round {round}</h3>
                {hasAnyOdds && (
                  <span className="text-green-400 text-sm">✓ Has odds</span>
                )}
              </div>
              <div className="p-6">
                <div className="grid gap-4">
                  {roundPredictions
                    .filter(
                      ({ user }) =>
                        !selectedUser || user.username === selectedUser,
                    )
                    .map(({ user, result, resultIndex }) => {
                      const pred = result.prediction!;
                      const kickoff = new Date(
                        pred.match.startDateTimeUtc,
                      ).toLocaleString();
                      const outcomeColor =
                        result.outcome === "W"
                          ? "text-green-400"
                          : "text-red-400";

                      return (
                        <div
                          key={`${user.username}-${resultIndex}`}
                          className="bg-slate-750 p-4 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            <div>
                              <p className="text-white font-bold">
                                {user.username}
                              </p>
                              <p
                                className={`text-sm font-bold ${outcomeColor}`}
                              >
                                {result.outcome === "W" ? "✓ WIN" : "✗ LOSS"}
                              </p>
                            </div>

                            <div className="md:col-span-2">
                              <p className="text-white font-medium">
                                {pred.match.homeName} vs {pred.match.awayName}
                              </p>
                              <div className="flex gap-4 text-sm text-slate-400 mt-1">
                                <span>
                                  Pick: <strong>{pred.type}</strong>
                                </span>
                                {pred.finalScore && (
                                  <span>
                                    Score: {pred.finalScore.home}-
                                    {pred.finalScore.away}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {kickoff}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-white font-medium whitespace-nowrap">
                                Odds:
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="1.01"
                                placeholder="e.g. 2.5"
                                value={pred.odds || ""}
                                onChange={(e) =>
                                  handleOddsChange(
                                    user.username,
                                    resultIndex,
                                    e.target.value,
                                  )
                                }
                                className="bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:outline-none focus:border-blue-500 w-full"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
