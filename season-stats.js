const data = require("./app/data/picks.json");

const players = data.map((p) => {
  const wins = p.results.filter((r) => r.outcome === "W").length;
  const losses = p.results.filter((r) => r.outcome === "L").length;

  // Streaks
  let maxWin = 0,
    maxLoss = 0,
    curWin = 0,
    curLoss = 0;
  for (const r of p.results) {
    if (r.outcome === "W") {
      curWin++;
      curLoss = 0;
    } else {
      curLoss++;
      curWin = 0;
    }
    maxWin = Math.max(maxWin, curWin);
    maxLoss = Math.max(maxLoss, curLoss);
  }
  const endStreak =
    p.results[p.results.length - 1].outcome === "W" ? curWin : -curLoss;

  // Count fine weeks (any emoji containing angry face)
  const fineWeeks = p.results.filter(
    (r) => r.emoji && r.emoji.includes("\u{1F621}"),
  ).length;

  return {
    name: p.username,
    wins,
    losses,
    total: wins + losses,
    pct: ((wins / (wins + losses)) * 100).toFixed(1),
    maxWin,
    maxLoss,
    fineWeeks,
    endStreak,
  };
});

console.log("=== STANDINGS ===");
const sorted = [...players].sort(
  (a, b) => b.wins - a.wins || a.losses - b.losses,
);
sorted.forEach((p, i) =>
  console.log(
    i +
      1 +
      ". " +
      p.name +
      ": " +
      p.wins +
      "W-" +
      p.losses +
      "L (" +
      p.pct +
      "%)",
  ),
);

console.log("\n=== LONGEST WIN STREAKS ===");
[...players]
  .sort((a, b) => b.maxWin - a.maxWin)
  .forEach((p) => console.log(p.name + ": " + p.maxWin));

console.log("\n=== LONGEST LOSS STREAKS ===");
[...players]
  .sort((a, b) => b.maxLoss - a.maxLoss)
  .forEach((p) => console.log(p.name + ": " + p.maxLoss));

console.log("\n=== FINE WEEKS ===");
[...players]
  .sort((a, b) => b.fineWeeks - a.fineWeeks)
  .forEach((p) => console.log(p.name + ": " + p.fineWeeks));

console.log("\n=== ENDING STREAK ===");
[...players]
  .sort((a, b) => b.endStreak - a.endStreak)
  .forEach((p) =>
    console.log(
      p.name +
        ": " +
        (p.endStreak > 0 ? p.endStreak + "W" : Math.abs(p.endStreak) + "L"),
    ),
  );

// Sole losers
console.log("\n=== SOLE LOSERS ===");
const weeks = data[0].results.length;
const soleLosers = {};
data.forEach((p) => (soleLosers[p.username] = 0));
for (let w = 0; w < weeks; w++) {
  const losers = data.filter((p) => p.results[w].outcome === "L");
  if (losers.length === 1) {
    soleLosers[losers[0].username]++;
    console.log("Week " + (w + 1) + ": " + losers[0].username);
  }
}
console.log("Totals:", JSON.stringify(soleLosers));

// All win weeks
console.log("\n=== ALL WIN WEEKS ===");
for (let w = 0; w < weeks; w++) {
  const allWin = data.every((p) => p.results[w].outcome === "W");
  if (allWin) console.log("Week " + (w + 1) + ": Everyone won!");
}

// Worst weeks
console.log("\n=== WORST WEEKS (5+ losses) ===");
for (let w = 0; w < weeks; w++) {
  const losers = data.filter((p) => p.results[w].outcome === "L");
  if (losers.length >= 5) {
    const winners = data
      .filter((p) => p.results[w].outcome === "W")
      .map((p) => p.username);
    console.log(
      "Week " +
        (w + 1) +
        ": " +
        losers.length +
        "/6 lost (only " +
        winners.join(", ") +
        " won)",
    );
  }
}

// Group totals
const totalWins = players.reduce((s, p) => s + p.wins, 0);
const totalLosses = players.reduce((s, p) => s + p.losses, 0);
console.log(
  "\n=== GROUP TOTAL: " +
    totalWins +
    "W-" +
    totalLosses +
    "L (" +
    ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1) +
    "%) ===",
);
console.log("Total weeks: " + weeks);

// Money
console.log("\n=== MONEY ===");
console.log("Weeks played: " + weeks);
console.log("Cost per person: \u00A3" + weeks * 10);
console.log("Returned per person: \u00A3337");
console.log("Net per person: -\u00A3" + (weeks * 10 - 337));
