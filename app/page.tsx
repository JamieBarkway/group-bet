"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Header from "./components/Header";
import PlayerSelector from "./components/PlayerSelector";
import Leaderboard from "./components/Leaderboard";
import ResultsHistory from "./components/ResultsHistory";
import WeekendFixtures from "./components/Fixtures";

export default function Page() {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if player is already selected in cookie
    const storedPlayer = Cookies.get("selectedPlayer");
    setSelectedPlayer(storedPlayer || null);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <p className="text-xl text-slate-300">Loading…</p>
      </div>
    );
  }

  if (!selectedPlayer) {
    return <PlayerSelector onPlayerSelected={setSelectedPlayer} />;
  }

  return (
    <>
      <Header selectedPlayer={selectedPlayer} onLogout={() => setSelectedPlayer(null)} />
      <main className="bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-6xl mx-auto">
          <Leaderboard selectedPlayer={selectedPlayer} />
          <ResultsHistory selectedPlayer={selectedPlayer} />
          <WeekendFixtures selectedPlayer={selectedPlayer} />
        </div>
      </main>
    </>
  );
}