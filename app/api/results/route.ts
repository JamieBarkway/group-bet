import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Telegram notification helper (copied from predictions/route.ts)
async function sendTelegramNotification(message: string) {
  const token = "7771975489:AAGVi4mSjqBXccJvUmJi0CYfhuM1wrwQK74";
  const chatId = "-5098513631";
  if (!token || !chatId) {
    console.log("Telegram not configured, skipping notification");
    return;
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      },
    );
    if (!response.ok) {
      console.error("Telegram notification failed:", await response.text());
    }
  } catch (error) {
    console.error("Telegram notification error:", error);
  }
}

const API_KEY = "wduFiC24P0EzR2GYJvaMONjPE7ECHKHexnhcoHHs";

// In-memory cache for results
let cachedResults: any[] | null = null;
let resultsCacheTimestamp: number | null = null;
const RESULTS_CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

const LEAGUES = [
  {
    name: "Premier League",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/premier-league:dYlOSQOD/2025-2026/results?page=1",
  },
  {
    name: "Championship",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/championship:2DSCa5fE/2025-2026/results?page=1",
  },
  {
    name: "League One",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/league-one:rJSMG3H0/2025-2026/results?page=1",
  },
  {
    name: "League Two",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/league-two:0MwU4NW6/2025-2026/results?page=1",
  },
  {
    name: "FA Cup",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/fa-cup:lYQtaqPQ/2025-2026/results?page=1",
  },
];
const DATA_PATH = path.join(process.cwd(), "app/data", "picks.json");

async function fetchLeagueResults(leagueName: string, endpoint: string) {
  const res = await fetch(endpoint, {
    headers: { "X-API-Key": API_KEY },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Failed to fetch ${leagueName} results`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || data.fixtures || [];
}

export async function GET() {
  try {
    // Check if cache is valid (less than 10 minutes old)
    const now = Date.now();
    if (
      cachedResults &&
      resultsCacheTimestamp &&
      now - resultsCacheTimestamp < RESULTS_CACHE_DURATION_MS
    ) {
      console.log("Returning cached results data");
      return NextResponse.json(cachedResults);
    }

    console.log("Fetching fresh results data from API");

    const leaguePromises = LEAGUES.map((l) =>
      fetchLeagueResults(l.name, l.endpoint)
        .then((data) => ({ league: l.name, results: data }))
        .catch((err) => ({ league: l.name, error: err.message, results: [] })),
    );
    const sets = await Promise.all(leaguePromises);
    const all = sets.flatMap((s) =>
      (Array.isArray(s.results) ? s.results : []).map((r: any) => ({
        ...r,
        league: s.league,
      })),
    );

    // Update cache
    cachedResults = all;
    resultsCacheTimestamp = now;

    return NextResponse.json(all);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function parseScoreInt(v: any): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function extractScores(result: any): {
  home: number | null;
  away: number | null;
  eventId?: string;
} {
  // Try common fields
  const fields = [["homeFullTimeScore", "awayFullTimeScore"]];
  let home: number | null = null;
  let away: number | null = null;
  for (const [h, a] of fields) {
    const hv = parseScoreInt(result?.[h]);
    const av = parseScoreInt(result?.[a]);
    if (hv !== null && av !== null) {
      home = hv;
      away = av;
      break;
    }
  }
  // Sometimes score string like "2-1"
  if ((home === null || away === null) && typeof result?.score === "string") {
    const m = result.score.match(/(\d+)\s*[-:]\s*(\d+)/);
    if (m) {
      home = parseInt(m[1], 10);
      away = parseInt(m[2], 10);
    }
  }
  const eventId =
    result?.eventId || result?.id || result?.event_id || undefined;
  return { home, away, eventId };
}

function decideWin(
  type: string,
  home: number | null,
  away: number | null,
): "W" | "L" | null {
  if (home === null || away === null) return null;
  switch (type) {
    case "Home":
      return home > away ? "W" : "L";
    case "Away":
      return away > home ? "W" : "L";
    case "BTTS":
      return home > 0 && away > 0 ? "W" : "L";
    case "O2.5":
      return home + away >= 3 ? "W" : "L";
    default:
      return null;
  }
}

function recalcEmojis(
  results: Array<{ outcome: "W" | "L" | "P"; emoji: string | null }>,
  specialEmojis?: Record<number, string>,
) {
  // Define special emojis that should be preserved (fine emojis)
  const specialEmojiSet = new Set(["🤢", "🤣", "🤦‍♂️", "😴"]);

  // Recompute emojis for win/loss streaks; pending predictions get no emoji
  let runOutcome: "W" | "L" | null = null;
  let runLen = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.outcome === "P") {
      r.emoji = null;
      runOutcome = null;
      runLen = 0;
      continue;
    }

    // Calculate streak
    if (r.outcome === runOutcome) {
      runLen += 1;
    } else {
      runOutcome = r.outcome;
      runLen = 1;
    }

    // Determine streak emoji - add one emoji for every 3 consecutive wins/losses
    const base = r.outcome === "W" ? "🔥" : "😡";
    const emojiCount = Math.floor(runLen / 3);
    const streakEmoji = base.repeat(emojiCount);

    // Check for special emoji
    let specialEmoji = "";
    if (specialEmojis && specialEmojis[i]) {
      specialEmoji = specialEmojis[i];
    } else if (r.emoji && specialEmojiSet.has(r.emoji)) {
      // Preserve existing special emoji
      specialEmoji = r.emoji;
    }

    // Combine special emoji and streak emoji
    const combined = specialEmoji + streakEmoji;
    r.emoji = combined || null;
  }
}

export async function POST() {
  try {
    // Load current picks
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const users: any[] = JSON.parse(raw);

    // Collect all pending predictions and find latest kickoff
    const pending: Array<{
      userIndex: number;
      resultIndex: number;
      type: string;
      eventId: string;
      start: Date;
    }> = [];
    for (let ui = 0; ui < users.length; ui++) {
      const u = users[ui];
      for (let ri = 0; ri < u.results.length; ri++) {
        const r = u.results[ri];
        if (
          r.outcome === "P" &&
          r.prediction?.match?.eventId &&
          r.prediction?.match?.startDateTimeUtc
        ) {
          pending.push({
            userIndex: ui,
            resultIndex: ri,
            type: r.prediction.type,
            eventId: r.prediction.match.eventId,
            start: new Date(r.prediction.match.startDateTimeUtc),
          });
        }
      }
    }

    // Initialize variables for settlement and emoji tracking
    let settled = 0;
    const specialEmojis: Record<number, Record<number, string>> = {}; // [userIndex][resultIndex] -> emoji

    // Only attempt to settle if there are pending predictions
    if (pending.length > 0) {
      const latestKickoff = new Date(
        Math.max(...pending.map((p) => p.start.getTime())),
      );
      const now = new Date();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (now.getTime() - latestKickoff.getTime() < twoHoursMs) {
        return NextResponse.json({
          settled: 0,
          message: "Too early to settle; latest game not 2h old",
        });
      }

      // Fetch all leagues results
      const leaguePromises = LEAGUES.map((l) => {
        return fetchLeagueResults(l.name, l.endpoint).catch(() => []);
      });
      const sets: any[][] = await Promise.all(leaguePromises);
      const allResults: any[] = sets.flat();
      console.log("Fetched results count:", allResults.length);
      // Build result map by eventId
      const byId = new Map<
        string,
        { home: number | null; away: number | null }
      >();
      for (const r of allResults) {
        const { home, away, eventId } = extractScores(r);
        if (eventId) byId.set(String(eventId), { home, away });
      }

      // Settle each pending prediction
      for (const p of pending) {
        const scores = byId.get(String(p.eventId));
        console.log("scores", scores, "eventId", p.eventId);
        if (!scores) continue;
        const outcome = decideWin(p.type, scores.home, scores.away);
        if (!outcome) continue;
        const target = users[p.userIndex].results[p.resultIndex];
        target.outcome = outcome;
        // attach final score info for UI details
        if (target.prediction) {
          target.prediction.finalScore = {
            home: scores.home,
            away: scores.away,
          } as any;
        }
        settled += 1;
      }

      // Apply special emojis for specific loss conditions
      for (const p of pending) {
        const target = users[p.userIndex].results[p.resultIndex];
        if (target.outcome !== "L") continue; // Only for losses

        const scores = byId.get(String(p.eventId));
        if (!scores || scores.home === null || scores.away === null) continue;

        // Check for 😴: BTTS/O2.5 picked but 0-0
        if (
          (p.type === "BTTS" || p.type === "O2.5") &&
          scores.home === 0 &&
          scores.away === 0
        ) {
          if (!specialEmojis[p.userIndex]) specialEmojis[p.userIndex] = {};
          specialEmojis[p.userIndex][p.resultIndex] = "😴";
          continue;
        }

        // Check for 🤣: Home/Away lost by 3+ goals
        const goalDiff = Math.abs(scores.home - scores.away);
        if ((p.type === "Home" || p.type === "Away") && goalDiff >= 3) {
          if (!specialEmojis[p.userIndex]) specialEmojis[p.userIndex] = {};
          specialEmojis[p.userIndex][p.resultIndex] = "🤣";
          continue;
        }
      }

      // Check for 🤢: only loser in the round
      const roundIndex = pending[0].resultIndex; // All pending should be same round

      // Check ALL users' results for this round (not just pending)
      const allResultsInRound = users
        .map((u, userIndex) => ({
          userIndex,
          outcome: u.results[roundIndex]?.outcome,
        }))
        .filter((r) => r.outcome === "W" || r.outcome === "L");

      const losersInRound = allResultsInRound.filter((r) => r.outcome === "L");

      if (losersInRound.length === 1) {
        const loserUserIndex = losersInRound[0].userIndex;
        // Only add 🤢 if they don't already have a special emoji
        if (!specialEmojis[loserUserIndex]?.[roundIndex]) {
          if (!specialEmojis[loserUserIndex])
            specialEmojis[loserUserIndex] = {};
          specialEmojis[loserUserIndex][roundIndex] = "🤢";
        }
      }
    }

    // Recalculate emojis per user, passing special emojis
    users.forEach((u, userIndex) =>
      recalcEmojis(u.results, specialEmojis[userIndex]),
    );

    // Persist results
    fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));

    // --- NEW: Send Telegram summary if all picks for the round are now settled ---
    // Only send if we just settled picks (not just recalculated)
    if (settled > 0 && pending.length > 0) {
      // All picks for this round should now be W/L (no P) for this round
      const roundIndex = pending[0].resultIndex;
      const allSettled = users.every(
        (u) =>
          u.results[roundIndex] &&
          (u.results[roundIndex].outcome === "W" ||
            u.results[roundIndex].outcome === "L"),
      );
      if (allSettled) {
        // Build summary message
        let summary = `📊 <b>Round ${roundIndex + 1} Results</b>\n\n`;
        users.forEach((u) => {
          const r = u.results[roundIndex];
          if (!r || !r.prediction) return;
          const pickType =
            r.prediction.type === "BTTS"
              ? "Both Teams To Score"
              : r.prediction.type === "O2.5"
                ? "Over 2.5 Goals"
                : `${r.prediction.type} Win`;
          const match = r.prediction.match;
          const score = r.prediction.finalScore
            ? ` (${r.prediction.finalScore.home}-${r.prediction.finalScore.away})`
            : "";
          const outcome = r.outcome === "W" ? "✅ Win" : "❌ Loss";
          summary += `<b>${u.username}</b>: ${pickType} - <i>${match.homeName} vs ${match.awayName}${score}</i>\n${outcome}\n\n`;
        });
        summary += `Well played! 🏁`;
        await sendTelegramNotification(summary);
      }
    }

    const message =
      settled > 0
        ? `Settled ${settled} predictions and recalculated emojis`
        : pending.length === 0
          ? "No pending predictions - recalculated emojis for all results"
          : "Recalculated emojis";

    return NextResponse.json({
      settled,
      message,
    });
  } catch (error) {
    return NextResponse.json(
      { settled: 0, error: String(error) },
      { status: 500 },
    );
  }
}
