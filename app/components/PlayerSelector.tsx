"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";

type PlayerSelectorProps = {
  onPlayerSelected: (playerName: string) => void;
};

export default function PlayerSelector({ onPlayerSelected }: PlayerSelectorProps) {
  const [players, setPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const res = await fetch("/api/picks/raw");
        const data = await res.json();
        const playerNames = data.map((p: any) => p.username);
        setPlayers(playerNames);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load players");
      } finally {
        setLoading(false);
      }
    };

    loadPlayers();
  }, []);

  const handleSelectPlayer = (playerName: string) => {
    Cookies.set("selectedPlayer", playerName, { expires: 365 });
    onPlayerSelected(playerName);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
        <p className="text-xl text-slate-300">Loading players…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
        <p className="text-xl text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <span className="text-4xl">⚽</span> GroupBet
          </h1>
          <p className="text-xl text-slate-300">Select your player to get started</p>
        </div>

        <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Choose Your Player</h2>
          <div className="space-y-3">
            {players.map((player) => (
              <button
                key={player}
                onClick={() => handleSelectPlayer(player)}
                className="w-full p-4 text-left bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-semibold text-lg border border-slate-600 hover:border-slate-500"
              >
                {player}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
