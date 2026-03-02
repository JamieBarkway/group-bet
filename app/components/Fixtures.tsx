"use client";

import { useEffect, useState } from "react";

type PredictionType = "Home" | "Away" | "BTTS" | "O2.5";

export default function WeekendFixtures({
  selectedPlayer,
}: {
  selectedPlayer?: string;
}) {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openLeagues, setOpenLeagues] = useState<{ [key: string]: boolean }>(
    {},
  );
  const [activeTab, setActiveTab] = useState<"midweek" | "weekend">("weekend");
  const [submitting, setSubmitting] = useState(false);
  const [hasPendingPrediction, setHasPendingPrediction] = useState(false);
  const [takenBy, setTakenBy] = useState<
    Record<string, { username: string; type: PredictionType }>
  >({}); // eventId -> {username, type}

  useEffect(() => {
    const loadPickState = async () => {
      try {
        const res = await fetch("/api/picks/raw");
        const data = await res.json();

        // map of eventId -> {username, type} for pending picks
        const taken: Record<
          string,
          { username: string; type: PredictionType }
        > = {};
        data.forEach((p: any) => {
          const pending = p.results.find(
            (r: any) => r.outcome === "P" && r.prediction?.match?.eventId,
          );
          if (pending && pending.prediction.match.eventId) {
            taken[pending.prediction.match.eventId] = {
              username: p.username,
              type: pending.prediction.type,
            };
          }
        });
        setTakenBy(taken);

        if (selectedPlayer) {
          const player = data.find((p: any) => p.username === selectedPlayer);
          if (player) {
            const hasPending = player.results.some(
              (r: any) => r.outcome === "P",
            );
            setHasPendingPrediction(hasPending);
          }
        }
      } catch (err) {
        console.error("Failed to load pick state:", err);
      }
    };

    loadPickState();
  }, [selectedPlayer]);

  const handlePrediction = async (match: any, type: PredictionType) => {
    if (!selectedPlayer) {
      alert("Please select a player first");
      return;
    }

    if (hasPendingPrediction) {
      alert(
        "You already have a pending prediction. Please remove it first before making a new selection.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedPlayer,
          prediction: {
            type,
            match: {
              homeName: match.homeName,
              awayName: match.awayName,
              homeLogo: match.homeLogo,
              awayLogo: match.awayLogo,
              startDateTimeUtc: match.startDateTimeUtc,
              eventId: match.eventId,
            },
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit prediction");
      }

      alert(
        `Prediction submitted: ${type} for ${match.homeName} vs ${match.awayName}`,
      );

      // Reload the page to refresh results
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit prediction");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const loadFixtures = async () => {
      try {
        const res = await fetch("/api/fixtures");

        if (!res.ok) throw new Error("Failed to load fixtures");

        const response = await res.json();
        // Handle both array response and object response with fixtures property
        const data: any[] = Array.isArray(response)
          ? response
          : response.fixtures || [];

        // Get fixtures for the next 7 days
        const now = new Date();
        const sevenDaysLater = new Date(now);
        sevenDaysLater.setDate(now.getDate() + 7);
        sevenDaysLater.setHours(23, 59, 59, 999);

        const next7Days = data.filter((f) => {
          const kickoff = new Date(f.startDateTimeUtc);
          return kickoff > now && kickoff <= sevenDaysLater;
        });

        setFixtures(next7Days);

        // Auto-select the tab based on what's available
        const hasMidweek = next7Days.some((f) => {
          const day = new Date(f.startDateTimeUtc).getDay();
          return day >= 1 && day <= 5; // Mon-Fri
        });
        const hasWeekend = next7Days.some((f) => {
          const day = new Date(f.startDateTimeUtc).getDay();
          return day === 0 || day === 6; // Sat-Sun
        });
        if (hasMidweek && !hasWeekend) setActiveTab("midweek");
        else if (hasWeekend) setActiveTab("weekend");

        // Initialize all leagues as open
        const leagues = [...new Set(next7Days.map((f) => f.league))];
        const leagueState: { [key: string]: boolean } = {};
        leagues.forEach((league) => {
          leagueState[league as string] = true;
        });
        setOpenLeagues(leagueState);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadFixtures();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xl text-slate-300">Loading fixtures…</p>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xl text-red-400">Error: {error}</p>
      </div>
    );

  if (!fixtures.length)
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xl text-slate-300">No upcoming fixtures found.</p>
      </div>
    );

  // Split fixtures into midweek (Mon-Fri) and weekend (Sat-Sun)
  const midweekFixtures = fixtures.filter((f) => {
    const day = new Date(f.startDateTimeUtc).getDay();
    return day >= 1 && day <= 5;
  });
  const weekendFixtures = fixtures.filter((f) => {
    const day = new Date(f.startDateTimeUtc).getDay();
    return day === 0 || day === 6;
  });

  const activeFixtures =
    activeTab === "midweek" ? midweekFixtures : weekendFixtures;

  // Group active fixtures by league, then by day
  const fixturesByLeague: { [key: string]: { [key: string]: any[] } } = {};

  activeFixtures.forEach((f) => {
    const league = f.league || "Unknown";
    const date = new Date(f.startDateTimeUtc);
    const dayKey = date.toLocaleDateString("en-GB", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    if (!fixturesByLeague[league]) {
      fixturesByLeague[league] = {};
    }
    if (!fixturesByLeague[league][dayKey]) {
      fixturesByLeague[league][dayKey] = [];
    }
    fixturesByLeague[league][dayKey].push(f);
  });

  const toggleLeague = (league: string) => {
    setOpenLeagues((prev) => ({
      ...prev,
      [league]: !prev[league],
    }));
  };

  return (
    <div id="fixtures-section" className="space-y-4">
      <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        Upcoming Fixtures
      </h3>

      {/* Midweek / Weekend tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("midweek")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            activeTab === "midweek"
              ? "bg-purple-600 text-white"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
          }`}
        >
          Midweek ({midweekFixtures.length})
        </button>
        <button
          onClick={() => setActiveTab("weekend")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            activeTab === "weekend"
              ? "bg-purple-600 text-white"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
          }`}
        >
          Weekend ({weekendFixtures.length})
        </button>
      </div>

      {activeFixtures.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-lg text-slate-400">
            No {activeTab} fixtures in the next 7 days.
          </p>
        </div>
      ) : (
        Object.keys(fixturesByLeague).map((league) => {
          const isOpen = openLeagues[league] || false;
          const days = Object.keys(fixturesByLeague[league]);

          return (
            <div
              key={league}
              className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-750 transition-colors"
                onClick={() => toggleLeague(league)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-sm">⚽</span>
                  <span className="text-base font-bold text-white">
                    {league}
                  </span>
                </div>
                <span className="text-white text-lg">{isOpen ? "−" : "+"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-slate-700">
                  {days.map((day, dayIndex) => (
                    <div key={day}>
                      {dayIndex > 0 && (
                        <div className="border-t border-slate-600"></div>
                      )}
                      <h3 className="text-sm font-bold text-yellow-400 px-3 py-2 bg-slate-750">
                        {day}
                      </h3>
                      <div className="divide-y divide-slate-700">
                        {fixturesByLeague[league][day].map((f) => (
                          <div
                            key={f.eventId}
                            className="p-3 hover:bg-slate-750 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-semibold text-blue-400">
                                {new Date(f.startDateTimeUtc).toLocaleString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-center mb-2">
                              <div className="flex-1 flex items-center justify-center gap-2">
                                {f.homeLogo && (
                                  <img
                                    src={f.homeLogo}
                                    alt={f.homeName}
                                    className="w-6 h-6 object-contain"
                                  />
                                )}
                                <p className="text-sm font-semibold text-white">
                                  {f.homeName}
                                </p>
                              </div>
                              <div className="px-2 text-slate-400 font-semibold text-xs">
                                vs
                              </div>
                              <div className="flex-1 flex items-center justify-center gap-2">
                                <p className="text-sm font-semibold text-white">
                                  {f.awayName}
                                </p>
                                {f.awayLogo && (
                                  <img
                                    src={f.awayLogo}
                                    alt={f.awayName}
                                    className="w-6 h-6 object-contain"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              {takenBy[f.eventId]?.type === "Home" ? (
                                <div className="px-2 py-1 bg-purple-600 text-white rounded font-semibold text-xs border border-purple-400 cursor-not-allowed">
                                  Picked by {takenBy[f.eventId].username}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handlePrediction(f, "Home")}
                                  disabled={submitting}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Home
                                </button>
                              )}
                              {takenBy[f.eventId]?.type === "Away" ? (
                                <div className="px-2 py-1 bg-purple-600 text-white rounded font-semibold text-xs border border-purple-400 cursor-not-allowed">
                                  Picked by {takenBy[f.eventId].username}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handlePrediction(f, "Away")}
                                  disabled={submitting}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Away
                                </button>
                              )}
                              {takenBy[f.eventId]?.type === "BTTS" ? (
                                <div className="px-2 py-1 bg-purple-600 text-white rounded font-semibold text-xs border border-purple-400 cursor-not-allowed">
                                  Picked by {takenBy[f.eventId].username}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handlePrediction(f, "BTTS")}
                                  disabled={submitting}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  BTTS
                                </button>
                              )}
                              {takenBy[f.eventId]?.type === "O2.5" ? (
                                <div className="px-2 py-1 bg-purple-600 text-white rounded font-semibold text-xs border border-purple-400 cursor-not-allowed">
                                  Picked by {takenBy[f.eventId].username}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handlePrediction(f, "O2.5")}
                                  disabled={submitting}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  O2.5
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
