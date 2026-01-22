import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const STATUS_PATH = path.join(process.cwd(), "app/data", "betStatus.json");
const PICKS_PATH = path.join(process.cwd(), "app/data", "picks.json");

// Initialize file if it doesn't exist
if (!fs.existsSync(STATUS_PATH)) {
  fs.writeFileSync(STATUS_PATH, JSON.stringify([], null, 2));
}

export async function GET() {
  try {
    const raw = fs.readFileSync(STATUS_PATH, "utf-8");
    const statuses = JSON.parse(raw);
    
    // Also get current week number
    const picksRaw = fs.readFileSync(PICKS_PATH, "utf-8");
    const users = JSON.parse(picksRaw);
    const maxResults = Math.max(...users.map((u: any) => u.results.length));
    const currentWeek = maxResults;
    
    // Find status for current week
    const currentStatus = statuses.find((s: any) => s.week === currentWeek);
    
    return NextResponse.json({
      currentWeek,
      status: currentStatus || null
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { username, week } = await req.json();

    if (!username || week === undefined) {
      return NextResponse.json({ error: "Missing username or week" }, { status: 400 });
    }

    const raw = fs.readFileSync(STATUS_PATH, "utf-8");
    const statuses = JSON.parse(raw);

    // Remove any existing status for this week
    const filtered = statuses.filter((s: any) => s.week !== week);
    
    // Add new status
    filtered.push({
      week,
      placedBy: username,
      timestamp: new Date().toISOString()
    });

    fs.writeFileSync(STATUS_PATH, JSON.stringify(filtered, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
