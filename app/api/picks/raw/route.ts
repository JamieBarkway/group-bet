import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_PATH = path.join(process.cwd(), "app/data", "picks.json");

export async function GET() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const users = JSON.parse(raw);
  
  return NextResponse.json(users);
}
