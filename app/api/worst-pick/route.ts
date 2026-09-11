import { NextResponse } from "next/server";
import {
  applyLock,
  ensureWeek,
  getCurrentWeek,
  getLockTime,
  getWorstPickStats,
  readUsers,
  readWeeks,
  tallyVotes,
  writeWeeks,
  WORST_PICK_FINE,
} from "@/app/lib/worstPick";

/**
 * GET → current round voting state (never exposes other players' votes until
 * the round has been revealed) plus all-time worst pick stats.
 */
export async function GET(req: Request) {
  try {
    const username = new URL(req.url).searchParams.get("username");
    const users = readUsers();
    const week = getCurrentWeek(users);
    const weeks = readWeeks();

    let entry = null;
    if (week > 0) {
      entry = ensureWeek(weeks, week);
      if (applyLock(users, entry)) writeWeeks(weeks);
    }

    const lockTime = week > 0 ? getLockTime(users, week) : null;
    const revealed = entry?.revealed ?? false;
    const { counts } = tallyVotes(entry?.votes ?? []);

    return NextResponse.json({
      week,
      fine: WORST_PICK_FINE,
      players: users.map((u) => u.username),
      lockTime: lockTime ? lockTime.toISOString() : null,
      locked: entry?.locked ?? false,
      revealed,
      votesCast: entry?.votes.length ?? 0,
      totalPlayers: users.length,
      myVote:
        username && entry
          ? (entry.votes.find((v) => v.voter === username)?.votedFor ?? null)
          : null,
      myVoteWasAuto:
        username && entry
          ? (entry.votes.find((v) => v.voter === username)?.auto ?? false)
          : false,
      // Only disclosed once the round has been settled and announced.
      result: revealed
        ? {
            worstPick: entry!.worstPick,
            tiedWith: entry!.tiedWith,
            fined: entry!.fined,
            counts,
            votes: entry!.votes,
          }
        : null,
      stats: getWorstPickStats(users, weeks),
    });
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

/* POST → cast or change a secret worst-pick vote for the current round */
export async function POST(req: Request) {
  try {
    const { username, votedFor } = await req.json();

    if (!username || !votedFor) {
      return NextResponse.json(
        { error: "Missing username or votedFor" },
        { status: 400 },
      );
    }

    const users = readUsers();
    const names = users.map((u) => u.username);
    if (!names.includes(username) || !names.includes(votedFor)) {
      return NextResponse.json({ error: "Unknown player" }, { status: 404 });
    }

    const week = getCurrentWeek(users);
    if (week < 1) {
      return NextResponse.json(
        { error: "No round is open for voting" },
        { status: 400 },
      );
    }

    const weeks = readWeeks();
    const entry = ensureWeek(weeks, week);
    applyLock(users, entry);

    if (entry.locked || entry.revealed) {
      writeWeeks(weeks);
      return NextResponse.json(
        { error: "Voting is locked for this round" },
        { status: 403 },
      );
    }

    entry.votes = entry.votes.filter((v) => v.voter !== username);
    entry.votes.push({
      voter: username,
      votedFor,
      auto: false,
      timestamp: new Date().toISOString(),
    });

    writeWeeks(weeks);

    return NextResponse.json({
      success: true,
      week,
      votesCast: entry.votes.length,
      totalPlayers: users.length,
    });
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
