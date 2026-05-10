import { NextResponse } from 'next/server';
import { getLiveGame, setLiveGame, getAllData, setAll } from '../../../lib/store';
import { finalizeToSeasonRecords } from '../../../lib/livegame';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/livegame — return the current live game (or null)
// This is what viewers poll every ~5 seconds.
export async function GET() {
  const game = await getLiveGame();
  return NextResponse.json({ game });
}

function checkAuth(req) {
  const cookie = req.cookies.get('blw_edit')?.value;
  const token = process.env.EDIT_TOKEN || process.env.EDIT_PASSWORD;
  return !!token && cookie === token;
}

// POST /api/livegame — replace the live game wholesale (used for setup / new game / clearing)
// Body: { game: <GameObject> | null }
export async function POST(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  await setLiveGame(body.game || null);
  return NextResponse.json({ ok: true });
}

// PATCH /api/livegame — append events to the live game
// Body: { events: [Event, ...] }
// This is what the scorekeeper hits when they tap a result button.
// Concurrent edits from multiple scorekeepers get merged by appending all events in order received.
export async function PATCH(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const newEvents = Array.isArray(body.events) ? body.events : [];

  const game = await getLiveGame();
  if (!game) return NextResponse.json({ error: 'no live game' }, { status: 404 });

  // Append, dedup by event id (so if a client retries, we don't duplicate)
  const existingIds = new Set(game.events.map(e => e.id));
  for (const ev of newEvents) {
    if (!ev.id || !existingIds.has(ev.id)) {
      game.events.push(ev);
      if (ev.id) existingIds.add(ev.id);
    }
  }

  await setLiveGame(game);
  return NextResponse.json({ game });
}

// DELETE /api/livegame — finalize the live game into season records, then clear it
// Or: pass ?discard=1 to delete without recording
export async function DELETE(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const discard = url.searchParams.get('discard') === '1';

  const game = await getLiveGame();
  if (!game) return NextResponse.json({ ok: true, finalized: false });

  if (discard) {
    await setLiveGame(null);
    return NextResponse.json({ ok: true, finalized: false });
  }

  // Finalize: merge into season records
  const { gameRecord, pas, pitchingLines } = finalizeToSeasonRecords(game);
  const all = await getAllData();
  const existingGames = (all.games || []).filter(g => g.id !== gameRecord.id);
  const existingPAs = (all.pas || []).filter(p => p.gameId !== gameRecord.id);
  const existingPit = (all.pitching || []).filter(p => p.gameId !== gameRecord.id);

  await setAll({
    teams: all.teams || [],
    players: all.players || [],
    games: [...existingGames, gameRecord],
    pas: [...existingPAs, ...pas],
    pitching: [...existingPit, ...pitchingLines],
  });

  await setLiveGame(null);
  return NextResponse.json({ ok: true, finalized: true, gameId: gameRecord.id });
}
