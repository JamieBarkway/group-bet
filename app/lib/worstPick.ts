import fs from "fs";
import path from "path";

const VOTES_PATH = path.join(process.cwd(), "app/data", "worstPickVotes.json");
const PICKS_PATH = path.join(process.cwd(), "app/data", "picks.json");

/** £ penalty applied when the player voted worst pick loses their bet. */
export const WORST_PICK_FINE = 5;
/** Added to the losing worst pick's result emoji; already part of the fine regex in /api/picks. */
export const WORST_PICK_EMOJI = "🤦‍♂️";

export type WorstPickVote = {
  voter: string;
  votedFor: string;
  auto: boolean;
  timestamp: string;
};

export type WorstPickWeek = {
  week: number; // 1-based round number
  votes: WorstPickVote[];
  locked: boolean;
  revealed: boolean;
  worstPick: string | null;
  tiedWith: string[];
  fined: boolean;
};

type PickUser = {
  username: string;
  results: Array<{
    outcome: "W" | "L" | "P" | "V";
    emoji: string | null;
    prediction?: {
      type: string | null;
      match?: { startDateTimeUtc?: string } | null;
    } | null;
  }>;
};

export function readUsers(): PickUser[] {
  return JSON.parse(fs.readFileSync(PICKS_PATH, "utf-8"));
}

export function readWeeks(): WorstPickWeek[] {
  if (!fs.existsSync(VOTES_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(VOTES_PATH, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeWeeks(weeks: WorstPickWeek[]) {
  fs.writeFileSync(VOTES_PATH, JSON.stringify(weeks, null, 2));
}

export function getPreviousVote(
  weeks: WorstPickWeek[],
  currentWeek: number,
  username: string,
): WorstPickVote | null {
  return (
    [...weeks]
      .filter((week) => week.week < currentWeek)
      .sort((a, b) => b.week - a.week)
      .find((week) => week.votes.some((vote) => vote.voter === username))
      ?.votes.find((vote) => vote.voter === username) ?? null
  );
}

export function getCurrentWeek(users: PickUser[]): number {
  if (users.length === 0) return 0;
  return Math.max(...users.map((u) => u.results.length));
}

/** Voting closes at the earliest kick-off of the round. */
export function getLockTime(users: PickUser[], week: number): Date | null {
  if (week < 1) return null;
  const kickoffs = users
    .map((u) => u.results[week - 1]?.prediction?.match?.startDateTimeUtc)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .map((t) => new Date(t).getTime())
    .filter((t) => !Number.isNaN(t));
  if (kickoffs.length === 0) return null;
  return new Date(Math.min(...kickoffs));
}

export function ensureWeek(
  weeks: WorstPickWeek[],
  week: number,
): WorstPickWeek {
  let entry = weeks.find((w) => w.week === week);
  if (!entry) {
    entry = {
      week,
      votes: [],
      locked: false,
      revealed: false,
      worstPick: null,
      tiedWith: [],
      fined: false,
    };
    weeks.push(entry);
  }
  return entry;
}

/**
 * Locks the week once kick-off has passed, auto-assigning a self-vote for
 * anybody who never voted. Returns true when the stored data changed.
 */
export function applyLock(
  users: PickUser[],
  entry: WorstPickWeek,
  force = false,
): boolean {
  if (entry.locked) return false;
  const lockTime = getLockTime(users, entry.week);
  const due = lockTime !== null && Date.now() >= lockTime.getTime();
  if (!force && !due) return false;

  const timestamp = new Date().toISOString();
  for (const u of users) {
    if (!entry.votes.some((v) => v.voter === u.username)) {
      entry.votes.push({
        voter: u.username,
        votedFor: u.username,
        auto: true,
        timestamp,
      });
    }
  }
  entry.locked = true;
  return true;
}

export function tallyVotes(votes: WorstPickVote[]): {
  counts: Record<string, number>;
  tied: string[];
} {
  const counts: Record<string, number> = {};
  for (const v of votes) {
    counts[v.votedFor] = (counts[v.votedFor] || 0) + 1;
  }
  const max = Math.max(0, ...Object.values(counts));
  const tied =
    max > 0
      ? Object.keys(counts)
          .filter((name) => counts[name] === max)
          .sort()
      : [];
  return { counts, tied };
}

/** Form going into `week`: wins in the last 5 settled rounds, and the current losing run. */
function getFormBefore(
  user: PickUser,
  week: number,
): { winsInLast5: number; losingStreak: number } {
  const settled = user.results
    .slice(0, Math.max(0, week - 1))
    .filter((r) => r.outcome === "W" || r.outcome === "L");
  const last5 = settled.slice(-5);
  let losingStreak = 0;
  for (let i = settled.length - 1; i >= 0 && settled[i].outcome === "L"; i--) {
    losingStreak++;
  }
  return {
    winsInLast5: last5.filter((r) => r.outcome === "W").length,
    losingStreak,
  };
}

/** Tie-break: the player in the worst form going into the round takes the hit. */
export function breakTieByForm(
  users: PickUser[],
  week: number,
  tied: string[],
): string | null {
  if (tied.length === 0) return null;
  if (tied.length === 1) return tied[0];

  return [...tied].sort((a, b) => {
    const ua = users.find((u) => u.username === a);
    const ub = users.find((u) => u.username === b);
    if (!ua || !ub) return a.localeCompare(b);
    const fa = getFormBefore(ua, week);
    const fb = getFormBefore(ub, week);
    if (fa.winsInLast5 !== fb.winsInLast5)
      return fa.winsInLast5 - fb.winsInLast5;
    if (fa.losingStreak !== fb.losingStreak)
      return fb.losingStreak - fa.losingStreak;
    return a.localeCompare(b);
  })[0];
}

export type WorstPickResolution = {
  week: number;
  worstPick: string | null;
  tiedWith: string[];
  fined: boolean;
  counts: Record<string, number>;
  votes: WorstPickVote[];
};

/**
 * Locks, tallies and reveals the worst pick for a settled round.
 * Idempotent: re-running returns the already stored resolution.
 */
export function resolveWorstPickWeek(
  users: PickUser[],
  week: number,
): WorstPickResolution | null {
  const weeks = readWeeks();
  const entry = ensureWeek(weeks, week);

  if (entry.revealed) {
    return {
      week,
      worstPick: entry.worstPick,
      tiedWith: entry.tiedWith,
      fined: entry.fined,
      counts: tallyVotes(entry.votes).counts,
      votes: entry.votes,
    };
  }

  applyLock(users, entry, true);
  const { counts, tied } = tallyVotes(entry.votes);
  const worstPick = breakTieByForm(users, week, tied);
  const fined =
    worstPick !== null &&
    users.find((u) => u.username === worstPick)?.results[week - 1]?.outcome ===
      "L";

  entry.worstPick = worstPick;
  entry.tiedWith = tied.length > 1 ? tied : [];
  entry.fined = fined;
  entry.revealed = true;
  writeWeeks(weeks);

  return {
    week,
    worstPick,
    tiedWith: entry.tiedWith,
    fined,
    counts,
    votes: entry.votes,
  };
}

export type WorstPickPlayerStats = {
  user: string;
  votedWorstCount: number;
  lostAsWorst: number;
  wonAsWorst: number;
  votesReceived: number;
  mostVotedFor: string | null;
  mostVotedForCount: number;
};

/** Aggregated stats across every revealed round. */
export function getWorstPickStats(
  users: PickUser[],
  weeks: WorstPickWeek[],
): WorstPickPlayerStats[] {
  const revealed = weeks.filter((w) => w.revealed);

  return users.map((u) => {
    const weeksAsWorst = revealed.filter((w) => w.worstPick === u.username);
    const outcomes = weeksAsWorst.map(
      (w) => u.results[w.week - 1]?.outcome ?? null,
    );

    const targetCounts: Record<string, number> = {};
    let votesReceived = 0;
    for (const w of revealed) {
      for (const v of w.votes) {
        if (v.voter === u.username) {
          targetCounts[v.votedFor] = (targetCounts[v.votedFor] || 0) + 1;
        }
        if (v.votedFor === u.username) votesReceived++;
      }
    }
    const mostVotedForCount = Math.max(0, ...Object.values(targetCounts));
    const mostVotedFor =
      mostVotedForCount > 0
        ? Object.keys(targetCounts)
            .filter((name) => targetCounts[name] === mostVotedForCount)
            .sort()
            .join(", ")
        : null;

    return {
      user: u.username,
      votedWorstCount: weeksAsWorst.length,
      lostAsWorst: outcomes.filter((o) => o === "L").length,
      wonAsWorst: outcomes.filter((o) => o === "W").length,
      votesReceived,
      mostVotedFor,
      mostVotedForCount,
    };
  });
}
