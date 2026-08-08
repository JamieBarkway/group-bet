import { NextResponse } from "next/server";

const API_KEY = "wduFiC24P0EzR2GYJvaMONjPE7ECHKHexnhcoHHs";

// In-memory cache
let cachedFixtures: any[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const LEAGUES = [
  {
    name: "Premier League",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/premier-league:dYlOSQOD/2026-2027/fixtures?page=1",
  },
  {
    name: "Championship",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/championship:2DSCa5fE/2026-2027/fixtures?page=1",
  },
  {
    name: "League One",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/league-one:rJSMG3H0/2026-2027/fixtures?page=1",
  },
  {
    name: "League Two",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/league-two:0MwU4NW6/2026-2027/fixtures?page=1",
  },
  {
    name: "FA Cup",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/fa-cup:lYQtaqPQ/2026-2027/fixtures?page=1",
  },
  {
    name: "EFL Cup",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/efl-cup:OMT80ou8/2026-2027/fixtures?page=1",
  },
  {
    name: "Scottish Premier League",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/scotland:199/premiership:tGwiyvJ1/2026-2027/fixtures?page=1",
  },
];

const oddsEndpoint =
  "https://api.sportdb.dev/api/flashscore/football/live/odds";

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: { "X-API-Key": API_KEY },
      cache: "no-store",
    });
    if (res.ok) return res;
    if (i < retries - 1)
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

async function fetchLeagueFixtures(leagueName: string, leagueEndpoint: string) {
  const res = await fetchWithRetry(leagueEndpoint);
  const data = await res.json();
  return data;
}

export async function GET() {
  try {
    // Check if cache is valid (less than 24 hours old)
    const now = Date.now();
    // if (
    //   cachedFixtures &&
    //   cacheTimestamp &&
    //   now - cacheTimestamp < CACHE_DURATION_MS
    // ) {
    //   console.log("Returning cached fixtures data");
    //   return NextResponse.json(cachedFixtures);
    // }

    console.log("Fetching fresh fixtures data from API");

    // Fetch all leagues in parallel
    const leaguePromises = LEAGUES.map((league) =>
      fetchLeagueFixtures(league.name, league.endpoint)
        .then((data) => ({
          league: league.name,
          fixtures: data,
        }))
        .catch((error) => ({
          league: league.name,
          error: error.message,
          fixtures: [],
        })),
    );

    const results = await Promise.all(leaguePromises);

    // Merge all fixtures with league information
    const allFixtures = results.flatMap((result) => {
      const fixturesArray = Array.isArray(result.fixtures)
        ? result.fixtures
        : [];

      return fixturesArray.map((fixture: any) => ({
        ...fixture,
        league: result.league,
      }));
    });

    // Fetch odds for all fixtures
    const eventIds = allFixtures.map((f: any) => f.eventId).filter(Boolean);
    const oddsMap: Record<
      string,
      { home: string; draw: string; away: string }
    > = {};

    if (eventIds.length > 0) {
      try {
        const oddsRes = await fetch(oddsEndpoint, {
          headers: { "X-API-Key": API_KEY },
          cache: "no-store",
        });
        if (oddsRes.ok) {
          const oddsData: any[] = await oddsRes.json();
          for (const odd of oddsData) {
            if (eventIds.includes(odd.eventId)) {
              oddsMap[odd.eventId] = {
                home: odd.odds1,
                draw: odd.odds0,
                away: odd.odds2,
              };
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch odds:", err);
      }
    }

    // Attach odds to fixtures
    const fixturesWithOdds = allFixtures.map((f: any) => ({
      ...f,
      odds: oddsMap[f.eventId] || null,
    }));

    // For fixtures missing odds, fetch from match-specific endpoint
    const missingOdds = fixturesWithOdds.filter(
      (f: any) => !f.odds && f.eventId,
    );
    if (missingOdds.length > 0) {
      const matchOddsPromises = missingOdds.map(async (f: any) => {
        try {
          const res = await fetch(
            `https://api.sportdb.dev/api/flashscore/match/${encodeURIComponent(f.eventId)}/odds?geoIpCode=GB&geoIpSubdivisionCode=GPENG`,
            { headers: { "X-API-Key": API_KEY }, cache: "no-store" },
          );
          if (!res.ok) return;
          const data: any[] = await res.json();
          const hdaEntry = data.find(
            (d: any) =>
              d.bettingScope === "FULL_TIME" &&
              d.bettingType === "HOME_DRAW_AWAY",
          );
          if (hdaEntry?.odds?.length >= 3) {
            f.odds = {
              home: hdaEntry.odds[0]?.value,
              draw: hdaEntry.odds[2]?.value,
              away: hdaEntry.odds[1]?.value,
            };
          }
        } catch {
          // Skip if individual match odds fetch fails
        }
      });
      await Promise.all(matchOddsPromises);
    }

    // Update cache
    cachedFixtures = fixturesWithOdds;
    cacheTimestamp = now;

    // If no fixtures found, include league status for debugging
    if (fixturesWithOdds.length === 0) {
      const response = {
        fixtures: fixturesWithOdds,
        leagueStatus: results,
      };
      return NextResponse.json(response);
    }

    return NextResponse.json(fixturesWithOdds);
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
