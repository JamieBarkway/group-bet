"use client";

import { useCallback, useEffect, useState } from "react";

type WorstPickResult = {
  worstPick: string | null;
  tiedWith: string[];
  fined: boolean;
  counts: Record<string, number>;
  votes: Array<{ voter: string; votedFor: string; auto: boolean }>;
};

type WorstPickState = {
  week: number;
  fine: number;
  players: string[];
  lockTime: string | null;
  locked: boolean;
  revealed: boolean;
  votesCast: number;
  totalPlayers: number;
  myVote: string | null;
  myVoteWasAuto: boolean;
  result: WorstPickResult | null;
};

export default function WorstPickVote({
  selectedPlayer,
}: {
  selectedPlayer?: string;
}) {
  const [state, setState] = useState<WorstPickState | null>(null);
  const [choice, setChoice] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedPlayer) return;
    try {
      const res = await fetch(
        `/api/worst-pick?username=${encodeURIComponent(selectedPlayer)}`,
      );
      const data = (await res.json()) as WorstPickState;
      setState(data);
      setChoice((prev) => prev || data.myVote || "");
    } catch {
      setError("Failed to load worst pick vote");
    }
  }, [selectedPlayer]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const submitVote = async (votedFor: string) => {
    if (!selectedPlayer) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/worst-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selectedPlayer, votedFor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save vote");
      setChoice(votedFor);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vote");
    } finally {
      setSaving(false);
    }
  };

  if (!selectedPlayer || !state || state.week < 1) return null;

  const lockLabel = state.lockTime
    ? new Date(state.lockTime).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mb-12">
      <h2 className="text-4xl font-bold text-white mb-6 flex items-center gap-2">
        <span>🗳️</span> Worst Pick of the Week
      </h2>
      <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
          <span className="bg-slate-700 text-slate-200 px-3 py-1 rounded-full">
            Round {state.week}
          </span>
          <span className="bg-slate-700 text-slate-200 px-3 py-1 rounded-full">
            {state.votesCast}/{state.totalPlayers} voted
          </span>
          {lockLabel && (
            <span className="bg-slate-700 text-slate-200 px-3 py-1 rounded-full">
              {state.locked ? "Locked at" : "Locks at"} {lockLabel}
            </span>
          )}
          {state.locked && !state.revealed && (
            <span className="bg-amber-600 text-white px-3 py-1 rounded-full font-semibold">
              🔒 Voting closed — result hidden until results are in
            </span>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {state.revealed && state.result ? (
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
            <p className="text-white font-bold mb-2">
              💩 Voted worst pick: {state.result.worstPick ?? "No votes cast"}
            </p>
            {state.result.tiedWith.length > 1 && (
              <p className="text-slate-400 text-xs mb-2">
                Tied on votes with{" "}
                {state.result.tiedWith
                  .filter((n) => n !== state.result!.worstPick)
                  .join(" & ")}{" "}
                — split on worst current form.
              </p>
            )}
            {state.result.fined ? (
              <p className="text-red-400 text-sm mb-3">
                It lost — £{state.fine} fine for {state.result.worstPick} 🤦‍♂️
              </p>
            ) : (
              <p className="text-green-400 text-sm mb-3">
                It won — no fine this week.
              </p>
            )}
            <div className="grid gap-1 text-xs text-slate-300">
              {state.result.votes.map((v) => (
                <div key={v.voter}>
                  <span className="text-slate-400">{v.voter}</span> →{" "}
                  <span className="text-white">{v.votedFor}</span>
                  {v.auto && (
                    <span className="text-amber-400"> (auto — no vote)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {state.players.map((name) => {
                const isChoice = choice === name;
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={state.locked || saving}
                    onClick={() => submitVote(name)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                      isChoice
                        ? "bg-red-600 border-red-400 text-white"
                        : "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {name}
                    {name === selectedPlayer && " (you)"}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              {state.myVote
                ? state.myVoteWasAuto
                  ? "You never voted in time, so your vote was auto-cast for yourself."
                  : `Your vote is locked in for ${state.myVote}.${state.locked ? "" : " You can change it until kick-off."}`
                : "You haven't voted yet."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
