import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_PATH = path.join(process.cwd(), "app/data", "picks.json");

export async function POST(req: Request) {
  try {
    const { username, prediction } = await req.json();

    if (!username || !prediction) {
      return NextResponse.json({ error: "Missing username or prediction" }, { status: 400 });
    }

    const { type, match } = prediction;

    if (!["Home", "Away", "BTTS", "O2.5"].includes(type)) {
      return NextResponse.json({ error: "Invalid prediction type" }, { status: 400 });
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
      return NextResponse.json({ error: "You already have a pending prediction" }, { status: 400 });
    }

    // Prevent duplicate picks on the same fixture by any user
    const isTaken = users.some((u: any) =>
      u.results?.some(
        (r: any) =>
          r.outcome === "P" &&
          r.prediction?.match?.eventId &&
          r.prediction.match.eventId === match.eventId
      )
    );

    if (isTaken) {
      return NextResponse.json({ error: "Someone already picked this fixture" }, { status: 400 });
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
          eventId: match.eventId
        }
      }
    });

    fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { username, resultIndex } = await req.json();

    if (!username || resultIndex === undefined) {
      return NextResponse.json({ error: "Missing username or resultIndex" }, { status: 400 });
    }

    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const users = JSON.parse(raw);

    const person = users.find((u: any) => u.username === username);
    if (!person) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (resultIndex < 0 || resultIndex >= person.results.length) {
      return NextResponse.json({ error: "Invalid result index" }, { status: 400 });
    }

    // Only allow deletion of pending predictions
    if (person.results[resultIndex].outcome !== "P") {
      return NextResponse.json({ error: "Can only delete pending predictions" }, { status: 400 });
    }

    // Remove the prediction
    person.results.splice(resultIndex, 1);

    fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
