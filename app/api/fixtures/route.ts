import { NextResponse } from "next/server";

const API_KEY = "yRSVmceJZCKAyreWme8hD3JKrIbpsOCSVI4JLEIj";

const LEAGUES = [
  {
    name: "Premier League",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/premier-league:dYlOSQOD/2025-2026/fixtures?page=1",
  },
  {
    name: "Championship",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/championship:2DSCa5fE/2025-2026/fixtures?page=1",
  },  
  {
    name: "League One",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/league-one:rJSMG3H0/2025-2026/fixtures?page=1",
  },
  {
    name: "League Two",
    endpoint:
      "https://api.sportdb.dev/api/flashscore/football/england:198/league-two:0MwU4NW6/2025-2026/fixtures?page=1",
  },
];

async function fetchLeagueFixtures(leagueName: string, leagueEndpoint: string) {
  const res = await fetch(leagueEndpoint, {
    headers: {
      "X-API-Key": API_KEY,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${leagueName} fixtures`);
  }

  const data = await res.json();
  return data;
}

export async function GET() {
  try {
    // Fetch all leagues in parallel
    const leaguePromises = LEAGUES.map(league =>
      fetchLeagueFixtures(league.name, league.endpoint)
        .then(data => ({
          league: league.name,
          fixtures: data,
        }))
        .catch(error => ({
          league: league.name,
          error: error.message,
          fixtures: [],
        }))
    );

    const results = await Promise.all(leaguePromises);


    // Merge all fixtures with league information
    const allFixtures = results.flatMap(result => {
      const fixturesArray = Array.isArray(result.fixtures)
        ? result.fixtures
        : [];

      return fixturesArray.map((fixture: any) => ({
        ...fixture,
        league: result.league,
      }));
    });

    // If no fixtures found, include league status for debugging
    if (allFixtures.length === 0) {
      return NextResponse.json({
        fixtures: allFixtures,
        leagueStatus: results,
      });
    }

    return NextResponse.json(allFixtures);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
