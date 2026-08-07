import { NextResponse } from "next/server";

const API_KEY = "wduFiC24P0EzR2GYJvaMONjPE7ECHKHexnhcoHHs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.sportdb.dev/api/flashscore/match/${encodeURIComponent(eventId)}/odds?geoIpCode=GB&geoIpSubdivisionCode=GPENG`,
      {
        headers: { "X-API-Key": API_KEY },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch match odds" },
        { status: res.status },
      );
    }

    const data: any[] = await res.json();

    // Extract Home/Draw/Away odds
    const hdaEntry = data.find(
      (d: any) =>
        d.bettingScope === "FULL_TIME" && d.bettingType === "HOME_DRAW_AWAY",
    );
    const homeOdds = hdaEntry?.odds?.[0]?.value || null;
    const drawOdds = hdaEntry?.odds?.[2]?.value || null;
    const awayOdds = hdaEntry?.odds?.[1]?.value || null;

    // Extract BTTS odds
    const bttsEntry = data.find(
      (d: any) =>
        d.bettingScope === "FULL_TIME" &&
        d.bettingType === "BOTH_TEAMS_TO_SCORE",
    );
    const bttsOdds = bttsEntry?.odds?.find(
      (o: any) => o.bothTeamsToScore === true,
    )?.value;

    // Extract Over 2.5 odds
    const ouEntry = data.find(
      (d: any) =>
        d.bettingScope === "FULL_TIME" && d.bettingType === "OVER_UNDER",
    );
    const o25Odds = ouEntry?.odds?.find(
      (o: any) => o.handicap?.value === "2.5" && o.selection === "OVER",
    )?.value;

    return NextResponse.json({
      home: homeOdds,
      draw: drawOdds,
      away: awayOdds,
      btts: bttsOdds || null,
      o25: o25Odds || null,
    });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
