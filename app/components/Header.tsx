"use client";

import Cookies from "js-cookie";

type HeaderProps = {
  selectedPlayer: string;
  onLogout: () => void;
};

export default function Header({ selectedPlayer, onLogout }: HeaderProps) {
  const handleLogout = () => {
    Cookies.remove("selectedPlayer");
    onLogout();
  };

  const scrollToFixtures = () => {
    const fixturesSection = document.getElementById("fixtures-section");
    if (fixturesSection) {
      fixturesSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 py-4 px-4 md:py-6 md:px-8">
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-3">
          <span className="text-3xl md:text-5xl">⚽</span>
          <h1 className="text-3xl md:text-5xl font-bold text-white">GroupBet</h1>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-center md:text-left">
            <span className="text-xs md:text-sm text-slate-300">Playing as:</span>
            <span className="text-sm md:text-lg font-bold text-yellow-400">{selectedPlayer}</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1 md:px-4 md:py-2 bg-red-600 hover:bg-red-700 text-white text-sm md:text-base rounded-lg font-semibold transition-colors"
          >
            Logout
          </button>
          <button
            onClick={scrollToFixtures}
            className="px-6 py-3 md:px-8 md:py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-base md:text-xl rounded-xl font-bold transition-all shadow-lg shadow-blue-900/50 hover:shadow-xl hover:shadow-blue-900/60 hover:scale-105 flex items-center gap-2"
          >
            <span className="text-xl md:text-2xl">⬇️</span>
            Jump to Fixtures
          </button>
        </div>
      </div>
    </header>
  );
}
