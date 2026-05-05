const TOKEN = "7771975489:AAGVi4mSjqBXccJvUmJi0CYfhuM1wrwQK74";
const CHAT_ID = "-5098513631";

async function sendMessage(text) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
    }),
  });
  if (!res.ok) {
    console.error("Failed:", await res.text());
  } else {
    console.log("Sent message (" + text.length + " chars)");
  }
  // Small delay to avoid rate limiting
  await new Promise((r) => setTimeout(r, 1000));
}

async function main() {
  const messages = [
    // Message 1: Header + Standings
    `<b>🏆 GROUP BET SEASON SUMMARY 2025/26 🏆</b>
<i>42 Weeks | 252 Picks | 139 Wins | 113 Losses</i>

<b>📊 FINAL STANDINGS</b>

🥇 Brett — 26W-16L (61.9%)
🥇 Clarky — 26W-16L (61.9%)
🥉 Gaz — 24W-18L (57.1%)
4. Andy Barky — 23W-19L (54.8%)
4. The Real Barky — 23W-19L (54.8%)
🥄 Hudo — 17W-25L (40.5%)`,

    // Message 2: Streaks
    `<b>🔥 LONGEST WIN STREAKS</b>

1. Andy Barky — <b>9 wins</b>
2. Gaz — <b>8 wins</b>
3. Brett — 7 wins
3. Hudo — 7 wins
5. Clarky — 5 wins
5. The Real Barky — 5 wins

<b>💀 LONGEST LOSS STREAKS</b>

1. Andy Barky — <b>7 losses</b>
2. Hudo — <b>6 losses</b>
3. The Real Barky — <b>5 losses</b>
4. Brett, Clarky, Gaz — 3 losses

Andy Barky holds BOTH the longest win AND loss streak. The ultimate streaky gambler.`,

    // Message 3: Fines + Sole losers
    `<b>😡 FINES LEADERBOARD (3+ loss streak weeks)</b>

1. Hudo — <b>9 fine weeks</b> 💸💸💸
2. Andy Barky — <b>6 fine weeks</b> 💸💸
3. The Real Barky — <b>5 fine weeks</b> 💸
4. Brett — 3 fine weeks
5. Clarky — 2 fine weeks
5. Gaz — 2 fine weeks

<b>🎯 THE ONLY LOSS (sole loser of the week)</b>

Clarky — 2 times (Weeks 17 &amp; 42)
The Real Barky — 2 times (Weeks 37 &amp; 38, back-to-back 😬)
Gaz — 1 time (Week 27)
Brett, Andy Barky, Hudo — 0 times

<b>🦸 SOLE SURVIVOR (only winner of the week)</b>

Brett — 2 times (Weeks 10 &amp; 18)
Clarky — 1 time (Week 33)`,

    // Message 4: Season moments + Form
    `<b>📅 SEASON MOMENTS</b>

✅ <b>Week 22</b> — The only week ALL 6 won. Perfect week!
❌ <b>Weeks 10 &amp; 18</b> — Only 1/6 won (Brett both times, carrying the group)
❌ <b>Week 33</b> — Only 1/6 won (Clarky alone)

<b>📈 FORM: FIRST 10 vs LAST 10 WEEKS</b>

Hudo: 2W-8L → 8W-2L (+6 📈)
Andy Barky: 2W-8L → 6W-4L (+4 📈)
Gaz: 5W-5L → 8W-2L (+3 📈)
Brett: 6W-4L → 8W-2L (+2 📈)
Clarky: 6W-4L → 5W-5L (-1 📉)
The Real Barky: 8W-2L → 4W-6L (-4 📉)

<b>Best comeback:</b> Hudo — From 2-8 start to finishing on a 7-game win streak 🔥🔥
<b>Biggest collapse:</b> The Real Barky — 8-2 start faded to a 5-game loss streak`,

    // Message 5: Bet types + Odds
    `<b>🎰 BET TYPE RECORDS (tracked weeks)</b>

Brett: Home 4-1 ✅ | BTTS 7-4
Andy Barky: Home 3-3 | Away 3-0 ✅ | BTTS 3-4
Clarky: Home 3-3 | Away 1-3 | BTTS 5-1 ✅
Hudo: Home 4-1 ✅ | Away 1-3 | BTTS 5-2
The Real Barky: Home 5-4 | BTTS 2-5 ❌
Gaz: Home 1-5 ❌ | Away 5-1 ✅ | BTTS 4-0 ✅

Gaz: 4-0 on BTTS but 1-5 on Home picks 💀
Andy Barky: 3-0 on Away picks — flawless
The Real Barky: 2-5 on BTTS — just stop

<b>🎲 HIGHEST ODDS WON</b>

🥇 Hudo — 2.25 (Hull to beat Swansea)
🥈 Clarky — 2.10 (Luton away at AFC Wimbledon)
🥈 The Real Barky — 2.10 (Norwich to beat West Brom)
🥉 Andy Barky — 2.00 (Stockport away at Exeter)
🥉 Gaz — 2.00 (Cardiff away at Rotherham)`,

    // Message 6: Money + Awards
    `<b>💰 MONEY SUMMARY</b>

Money spent per person: <b>£420</b> (42 weeks × £10)
Money returned per person: <b>£337</b>
Net loss per person: <b>-£83</b>
Total group loss: <b>-£498</b>
Group win rate: <b>55.2%</b>

<b>🏅 SEASON AWARDS</b>

🏆 Joint Champions: Brett &amp; Clarky (26-16)
🥄 Wooden Spoon: Hudo (17-25)
🔥 Streak King: Andy Barky (9 wins in a row)
💀 Streak Victim: Andy Barky (7 losses in a row)
💸 Most Fined: Hudo (9 fine weeks)
🧱 Mr Reliable: Brett &amp; Gaz (never lost more than 3 in a row)
📈 Best Comeback: Hudo (2-8 start → 7-game win streak finish)
📉 Biggest Bottler: The Real Barky (8-2 start → 5 losses in a row late)
🎯 Mr BTTS: Gaz (4-0, perfect)
🙈 Solo Shame: The Real Barky (sole loser back-to-back Weeks 37 &amp; 38)
🦸 Group Saviour: Brett (sole winner TWICE)
🏁 Best Ending: Gaz (8 straight wins to close)

<i>Overall group record: 55.2% — See you next season! 🍻</i>`,
  ];

  console.log("Sending " + messages.length + " messages to Telegram...\n");

  for (let i = 0; i < messages.length; i++) {
    console.log("Sending part " + (i + 1) + "/" + messages.length + "...");
    await sendMessage(messages[i]);
  }

  console.log("\nDone! All messages sent.");
}

main();
