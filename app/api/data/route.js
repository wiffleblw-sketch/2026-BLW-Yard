import { NextResponse } from 'next/server';
import { getAllData, setAll } from '../../../lib/store';
import {
  DEFAULT_TEAMS, DEFAULT_PLAYERS, DEFAULT_GAMES, DEFAULT_PAS, DEFAULT_PITCHING,
} from '../../../lib/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/data — return all data, seeding defaults if empty
export async function GET() {
  let data = await getAllData();

  // First-deploy seed: if everything is empty, write the defaults
  if (!data.teams && !data.games) {
    const seed = {
      teams: DEFAULT_TEAMS,
      players: DEFAULT_PLAYERS,
      games: DEFAULT_GAMES,
      pas: DEFAULT_PAS,
      pitching: DEFAULT_PITCHING,
    };
    await setAll(seed);
    data = seed;
  } else {
    data = {
      teams: data.teams || DEFAULT_TEAMS,
      players: data.players || DEFAULT_PLAYERS,
      games: data.games || DEFAULT_GAMES,
      pas: data.pas || DEFAULT_PAS,
      pitching: data.pitching || DEFAULT_PITCHING,
    };
  }

  return NextResponse.json(data);
}

// POST /api/data — write all data (requires edit auth)
export async function POST(req) {
  // Auth check: cookie set by /api/auth
  const cookie = req.cookies.get('blw_edit')?.value;
  if (cookie !== process.env.EDIT_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const { teams, players, games, pas, pitching } = body;
  if (!Array.isArray(teams) || !Array.isArray(players) || !Array.isArray(games) || !Array.isArray(pas) || !Array.isArray(pitching)) {
    return NextResponse.json({ error: 'invalid shape' }, { status: 400 });
  }

  await setAll({ teams, players, games, pas, pitching });
  return NextResponse.json({ ok: true });
}
