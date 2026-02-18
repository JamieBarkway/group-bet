import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_PATH = path.join(process.cwd(), "app/data", "picks.json");

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

export async function POST(req: Request) {
  try {
    const { username, prediction } = await req.json();

    if (!username || !prediction) {
      return NextResponse.json(
        { error: "Missing username or prediction" },
        { status: 400 },
      );
    }

    const { type, match } = prediction;

    if (!["Home", "Away", "BTTS", "O2.5"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid prediction type" },
        { status: 400 },
      );
    }

    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const users = JSON.parse(raw);

    const person = users.find((u: any) => u.username === username);
    if (!person) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user already has a pending prediction
    const hasPending = person.results.some((r: any) => r.outcome === "P");
    if (hasPending) {
      return NextResponse.json(
        { error: "You already have a pending prediction" },
        { status: 400 },
      );
    }

    // Prevent duplicate picks on the same fixture by any user
    const isTaken = users.some((u: any) =>
      u.results?.some(
        (r: any) =>
          r.outcome === "P" &&
          r.prediction?.match?.eventId &&
          r.prediction.match.eventId === match.eventId,
      ),
    );

    if (isTaken) {
      return NextResponse.json(
        { error: "Someone already picked this fixture" },
        { status: 400 },
      );
    }

    // Add pending prediction
    person.results.push({
      outcome: "P", // P for Pending
      emoji: null,
      prediction: {
        type,
        match: {
          homeName: match.homeName,
          awayName: match.awayName,
          startDateTimeUtc: match.startDateTimeUtc,
          eventId: match.eventId,
        },
      },
    });

    fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));

    // Send Telegram notification
    const predictionText =
      type === "BTTS"
        ? "Both Teams To Score"
        : type === "O2.5"
          ? "Over 2.5 Goals"
          : `${type} Win`;

    const message =
      `🎯 <b>New Pick!</b>\n\n` +
      `<b>${username}</b> picked:\n` +
      `${predictionText}\n\n` +
      `<i>${match.homeName} vs ${match.awayName}</i>`;

    await sendTelegramNotification(message);

    // Check if all users have made their picks
    const allUsersHavePicks = users.every((u: any) =>
      u.results.some((r: any) => r.outcome === "P"),
    );

    if (allUsersHavePicks) {
      // Build comprehensive list of all picks
      let allPicksMessage = `🔥 <b>ALL PICKS ARE IN!</b> 🔥\n\n`;

      users.forEach((u: any) => {
        const pendingPick = u.results.find((r: any) => r.outcome === "P");
        if (pendingPick?.prediction) {
          const pickType =
            pendingPick.prediction.type === "BTTS"
              ? "Both Teams To Score"
              : pendingPick.prediction.type === "O2.5"
                ? "Over 2.5 Goals"
                : `${pendingPick.prediction.type} Win`;

          allPicksMessage += `<b>${u.username}</b>: ${pickType}\n`;
          allPicksMessage += `<i>${pendingPick.prediction.match.homeName} vs ${pendingPick.prediction.match.awayName}</i>\n\n`;
        }
      });

      // Calculate streaks and fine risks
      const streakSummary: any[] = [];
      users.forEach((u: any) => {
        // Get only non-pending results (completed outcomes)
        const completedResults = u.results.filter(
          (r: any) => r.outcome === "W" || r.outcome === "L",
        );

        if (completedResults.length > 0) {
          // Find current streak from the end
          let currentStreak = 1;
          let currentType =
            completedResults[completedResults.length - 1].outcome;

          for (
            let i = completedResults.length - 2;
            i >= 0 && completedResults[i].outcome === currentType;
            i--
          ) {
            currentStreak++;
          }

          // Check for loss streaks that put player at risk
          if (currentType === "L" && currentStreak >= 2) {
            const fineRisk =
              currentStreak === 2 ? "£5" : `£${currentStreak * 5}`;
            streakSummary.push(
              `⚠️ <b>${u.username}</b> is on ${currentStreak} losses in a row - risk of ${fineRisk} fine if he loses this week`,
            );
          }
        }
      });

      // Add streak summary if there are any at-risk players
      if (streakSummary.length > 0) {
        allPicksMessage += `\n\n📊 <b>Streak Alert:</b>\n`;
        allPicksMessage += streakSummary.join("\n");
      }

      allPicksMessage += `\n\nGood luck everyone! 🍀`;

      await sendTelegramNotification(allPicksMessage);
    }

    return NextResponse.json({ success: true });
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

export async function DELETE(req: Request) {
  try {
    const { username, resultIndex } = await req.json();

    if (!username || resultIndex === undefined) {
      return NextResponse.json(
        { error: "Missing username or resultIndex" },
        { status: 400 },
      );
    }

    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const users = JSON.parse(raw);

    const person = users.find((u: any) => u.username === username);
    if (!person) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (resultIndex < 0 || resultIndex >= person.results.length) {
      return NextResponse.json(
        { error: "Invalid result index" },
        { status: 400 },
      );
    }

    // Only allow deletion of pending predictions
    if (person.results[resultIndex].outcome !== "P") {
      return NextResponse.json(
        { error: "Can only delete pending predictions" },
        { status: 400 },
      );
    }

    // Capture prediction details before deletion for notification
    const deletedPrediction = person.results[resultIndex];
    const match = deletedPrediction.prediction?.match;

    // Remove the prediction
    person.results.splice(resultIndex, 1);

    fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));

    // Send funny Telegram notification about being indecisive
    const funnyMessages = [
      `🤡 <b>${username}</b> can’t even commit to being wrong.`,
      `💀 <b>${username}</b> deleted their bet… coward move.`,
      `🐔 <b>${username}</b> chickened out—again. Pathetic.`,
      `🎭 <b>${username}</b> switched roles from gambler to spectator.`,
      `🦥 <b>${username}</b> slow to bet, fast to bail.`,
      `🐀 <b>${username}</b> squeaked and bolted.`,
      `🩸 <b>${username}</b> aborted mission… tragic.`,
    ];

    const randomMessage =
      funnyMessages[Math.floor(Math.random() * funnyMessages.length)];

    if (match) {
      await sendTelegramNotification(
        randomMessage + `\n\n❌ <i>${match.homeName} vs ${match.awayName}</i>`,
      );
    } else {
      await sendTelegramNotification(randomMessage);
    }

    return NextResponse.json({ success: true });
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
