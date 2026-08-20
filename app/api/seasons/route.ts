import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_DIR = path.join(process.cwd(), "app/data");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season");

  if (!season) {
    // Return list of available seasons
    const files = fs
      .readdirSync(DATA_DIR)
      .filter((f) => f.startsWith("season-"));
    const seasons = files
      .map((f) => {
        const match = f.match(/^season-(\d+)-(\d+)\.json$/);
        if (!match) return null;
        return {
          id: `${match[1]}-${match[2]}`,
          label: `${match[1]}/${match[2]}`,
        };
      })
      .filter(Boolean);
    return NextResponse.json(seasons);
  }

  // Return leaderboard for a specific season
  const filePath = path.join(DATA_DIR, `season-${season}.json`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const users = JSON.parse(raw);

  const leaderboard = users
    .map(getStats)
    .sort((a: any, b: any) => parseFloat(b.winPct) - parseFloat(a.winPct));

  return NextResponse.json({ leaderboard, results: users });
}

function getStats(user: {
  username: string;
  results: Array<{
    outcome: "W" | "L" | "P" | "V";
    emoji: string | null;
    prediction?: {
      type: string | null;
      match: {
        homeName: string;
        awayName: string;
        startDateTimeUtc: string;
        eventId: string;
      } | null;
      finalScore?: { home: number; away: number };
      odds?: number;
    };
  }>;
}) {
  const settledResults = user.results.filter(
    (r) => r.outcome === "W" || r.outcome === "L",
  );
  const total = settledResults.length;
  const wins = user.results.filter((r) => r.outcome === "W").length;
  const losses = user.results.filter((r) => r.outcome === "L").length;
  const winPct = total ? ((wins / total) * 100).toFixed(1) : "0.0";
  const totalWithResults = settledResults.filter(
    (r) => r.prediction?.type && r.prediction.match,
  ).length;
  const bttsPct = totalWithResults
    ? (
        (settledResults.filter((r) => r.prediction?.type === "BTTS").length /
          totalWithResults) *
        100
      ).toFixed(1)
    : "0.0";
  const homeWinPct = totalWithResults
    ? (
        (settledResults.filter((r) => r.prediction?.type === "Home").length /
          totalWithResults) *
        100
      ).toFixed(1)
    : "0.0";
  const awayWinPct = totalWithResults
    ? (
        (settledResults.filter((r) => r.prediction?.type === "Away").length /
          totalWithResults) *
        100
      ).toFixed(1)
    : "0.0";
  const o2GoalsPct = totalWithResults
    ? (
        (settledResults.filter((r) => r.prediction?.type === "O2.5").length /
          totalWithResults) *
        100
      ).toFixed(1)
    : "0.0";

  const finePattern = /(😴|🤢|🤣|🤦‍♂️|😡)/g;
  let fineCount = 0;
  for (const r of user.results) {
    if (r.emoji) {
      const hits = r.emoji.match(finePattern);
      fineCount += hits ? hits.length : 0;
    }
  }
  const fineTotal = fineCount * 5;

  let longestWinStreak = 0;
  let currentWinStreak = 0;
  let longestLossStreak = 0;
  let currentLossStreak = 0;

  for (const result of user.results) {
    if (result.outcome === "W") {
      currentWinStreak++;
      currentLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
    } else if (result.outcome === "L") {
      currentLossStreak++;
      currentWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
    } else {
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  }

  const last5 = settledResults
    .slice(-5)
    .map((r) => r.outcome)
    .join("");
  const form = last5 || "-";

  let currentStreak = 0;
  const lastResult = [...user.results]
    .reverse()
    .find((r) => r.outcome === "W" || r.outcome === "L");
  if (lastResult) {
    const targetOutcome = lastResult.outcome;
    for (let i = user.results.length - 1; i >= 0; i--) {
      if (user.results[i].outcome === "P") {
        continue;
      }
      if (user.results[i].outcome === targetOutcome) {
        currentStreak++;
      } else {
        break;
      }
    }
    if (targetOutcome === "L") currentStreak *= -1;
  }

  const resultsWithOdds = user.results.filter(
    (r) => r.prediction?.odds && (r.outcome === "W" || r.outcome === "L"),
  );
  const avgOdds =
    resultsWithOdds.length > 0
      ? (
          resultsWithOdds.reduce(
            (sum, r) => sum + (r.prediction?.odds || 0),
            0,
          ) / resultsWithOdds.length
        ).toFixed(2)
      : "0.00";

  const winningResultsWithOdds = user.results.filter(
    (r) => r.prediction?.odds && r.outcome === "W",
  );
  const avgWinningOdds =
    winningResultsWithOdds.length > 0
      ? (
          winningResultsWithOdds.reduce(
            (sum, r) => sum + (r.prediction?.odds || 0),
            0,
          ) / winningResultsWithOdds.length
        ).toFixed(2)
      : "0.00";

  return {
    user: user.username,
    total,
    wins,
    losses,
    winPct,
    form,
    fineCount,
    fineTotal,
    currentStreak,
    longestWinStreak,
    longestLossStreak,
    bttsPct,
    homeWinPct,
    awayWinPct,
    o2GoalsPct,
    avgOdds,
    avgWinningOdds,
  };
}
