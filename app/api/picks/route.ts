import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_PATH = path.join(process.cwd(), "app/data", "picks.json");

/* GET → return leaderboard */
export async function GET() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const users = JSON.parse(raw);

  const leaderboard = users
    .map(getStats)
    .sort((a, b) => b.winPct - a.winPct);

  return NextResponse.json(leaderboard);
}

function getStats(user: { username: string; results: Array<{ outcome: "W" | "L" | "P"; emoji: string | null, prediction: {
          type: string,
          match: {
            homeName: string,
            awayName: string,
            startDateTimeUtc: string,
            eventId: string
          }
        } }> }) {
  const total = user.results.filter(r => r.outcome !== "P").length; // Exclude pending predictions
  const wins = user.results.filter(r => r.outcome === "W").length;
  const losses = total - wins;
  const winPct = total ? ((wins / total) * 100).toFixed(1) : "0.0";
  const totalWithResults = user.results.filter(r => r.prediction != null).length;
  const bttsPct = total ? ((user.results.filter(r => r.prediction?.type === "BTTS").length / totalWithResults) * 100).toFixed(1) : "0.0";
  const homeWinPct = total ? ((user.results.filter(r => r.prediction?.type === "Home").length / totalWithResults) * 100).toFixed(1) : "0.0";
  const awayWinPct = total ? ((user.results.filter(r => r.prediction?.type === "Away").length / totalWithResults) * 100).toFixed(1) : "0.0";
  const o2GoalsPct = total ? ((user.results.filter(r => r.prediction?.type === "O2.5").length / totalWithResults) * 100).toFixed(1) : "0.0";

  // Fine calculation: £5 per penalty emoji
  const finePattern = /(😴|🤢|🤣|🤦‍♂️|😡)/g;
  let fineCount = 0;
  for (const r of user.results) {
    if (r.emoji) {
      const hits = r.emoji.match(finePattern);
      fineCount += hits ? hits.length : 0;
    }
  }
  const fineTotal = fineCount * 5;

  // Calculate longest win streak
  let longestWinStreak = 0;
  let currentWinStreak = 0;
  
  // Calculate longest loss streak
  let longestLossStreak = 0;
  let currentLossStreak = 0;
  

  for (const result of user.results) {
    if (result.outcome === "W") {
      currentWinStreak++;
      currentLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
    }
  }

  // Get last 5 results (excluding pending)
  const settledResults = user.results.filter(r => r.outcome !== "P");
  const last5 = settledResults.slice(-5).map(r => r.outcome).join("");
  const form = last5 || "-";

  // Calculate current streak
  let currentStreak = 0;
  const lastResult = settledResults.at(-1);
  
  if (lastResult) {
    const targetOutcome = lastResult.outcome;
    console.log("Last result:", targetOutcome);
    
    for (let i = settledResults.length - 1; i >= 0; i--) {
      console.log("Next result", settledResults[i].outcome);
      if (settledResults[i].outcome === targetOutcome) {
        currentStreak++;
        console.log("Current streak:", currentStreak);
      } else {
        break;
      }
    }
    if (targetOutcome === "L"){
      currentStreak *= -1;
    }
  }

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
    o2GoalsPct
  };
}

/* POST → add a new result (W/L) */
export async function POST(req: Request) {
  const { username, result } = await req.json();

  if (!["W", "L"].includes(result)) {
    return NextResponse.json({ error: "Invalid result" }, { status: 400 });
  }

  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const users = JSON.parse(raw);

  const person = users.find((u: any) => u.username === username);
  if (!person) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Calculate if this result creates a streak of 3+
  let currentStreak = 1;
  for (let i = person.results.length - 1; i >= 0; i--) {
    if (person.results[i].outcome === result) {
      currentStreak++;
    } else {
      break;
    }
  }

  const baseEmoji = result === "W" ? "🔥" : "😡";
  const emoji = currentStreak >= 6 ? baseEmoji + baseEmoji : currentStreak >= 2 ? baseEmoji : null;

  person.results.push({
    outcome: result,
    emoji: emoji
  });

  // Update emoji for previous results in the streak if we just hit 3 or 6
  if (currentStreak === 2 || currentStreak === 5) {
    const streakEmoji = currentStreak === 5 ? baseEmoji + baseEmoji : baseEmoji;
    for (let i = person.results.length - (currentStreak === 2 ? 3 : 6); i < person.results.length; i++) {
      if (i >= 0 && person.results[i] && person.results[i].outcome === result) {
        person.results[i].emoji = streakEmoji;
      }
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));

  return NextResponse.json({ success: true });
}