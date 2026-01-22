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

  return (
    <header className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 py-4 px-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚽</span>
          <h1 className="text-2xl font-bold text-white">GroupBet</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-300">Playing as:</span>
            <span className="text-lg font-bold text-yellow-400">{selectedPlayer}</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
