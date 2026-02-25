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

type OddsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roundNumber: number;
};

export default function OddsModal({
  isOpen,
  onClose,
  roundNumber,
}: OddsModalProps) {
  const [users, setUsers] = useState<UserWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
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

  const handleOddsChange = (username: string, value: string) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) => {
        if (user.username !== username) return user;
        return {
          ...user,
          results: user.results.map((result, idx) => {
            if (idx !== roundNumber - 1) return result;
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
                    ? parseFloat(result.prediction.odds) || undefined
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
      setTimeout(() => {
        setMessage(null);
        onClose();
      }, 1500);
    } catch (error) {
      setMessage("❌ Failed to save odds");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Get predictions for the specific round
  const roundPredictions = users
    .map((user) => ({
      user,
      result: user.results[roundNumber - 1],
      resultIndex: roundNumber - 1,
    }))
    .filter(
      ({ result }) =>
        result &&
        result.prediction &&
        (result.outcome === "W" || result.outcome === "L"),
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-3xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>📊</span> Enter Odds - Round {roundNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {message && (
            <div className="mb-4 p-3 bg-slate-700 border border-slate-600 rounded-lg">
              <p className="text-white text-center text-sm">{message}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-300">Loading...</p>
            </div>
          ) : roundPredictions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">
                No completed predictions for this round
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {roundPredictions.map(({ user, result }) => {
                const pred = result.prediction!;
                const kickoff = new Date(
                  pred.match.startDateTimeUtc,
                ).toLocaleString();
                const outcomeColor =
                  result.outcome === "W" ? "text-green-400" : "text-red-400";

                return (
                  <div
                    key={user.username}
                    className="bg-slate-750 p-4 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_140px] gap-4 items-center">
                      {/* Player info */}
                      <div>
                        <p className="text-white font-bold text-sm">
                          {user.username}
                        </p>
                        <p className={`text-xs font-bold ${outcomeColor}`}>
                          {result.outcome === "W" ? "✓ WIN" : "✗ LOSS"}
                        </p>
                      </div>

                      {/* Match info */}
                      <div>
                        <p className="text-white font-medium text-sm">
                          {pred.match.homeName} vs {pred.match.awayName}
                        </p>
                        <div className="flex gap-3 text-xs text-slate-400 mt-1">
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
                        <p className="text-xs text-slate-500 mt-1">{kickoff}</p>
                      </div>

                      {/* Odds input */}
                      <div className="flex items-center gap-2">
                        <label className="text-white font-medium text-sm whitespace-nowrap">
                          Odds:
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="1.01"
                          placeholder="2.5"
                          value={pred.odds || ""}
                          onChange={(e) =>
                            handleOddsChange(user.username, e.target.value)
                          }
                          className="bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:outline-none focus:border-blue-500 w-full text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-900 px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
          >
            {saving ? "Saving..." : "💾 Save Odds"}
          </button>
        </div>
      </div>
    </div>
  );
}
