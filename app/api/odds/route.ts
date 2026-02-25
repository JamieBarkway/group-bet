import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "app/data", "picks.json");

export async function POST(req: Request) {
  try {
    const { users } = await req.json();

    if (!users || !Array.isArray(users)) {
      return NextResponse.json(
        { error: "Invalid data format" },
        { status: 400 },
      );
    }

    // Write the updated data back to the file
    fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));

    return NextResponse.json({
      success: true,
      message: "Odds updated successfully",
    });
  } catch (error) {
    console.error("Error updating odds:", error);
    return NextResponse.json(
      {
        error: "Failed to update odds",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
