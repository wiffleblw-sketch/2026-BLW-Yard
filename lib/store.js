/**
 * Data store for BLW Yard.
 *
 * In production (Vercel), data is persisted in Vercel KV (Redis).
 * In local development without KV configured, data falls back to a JSON file
 * in /tmp so you can develop without setting up a database.
 */

import { kv } from '@vercel/kv';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_KEYS = {
  teams: 'blw:teams',
  players: 'blw:players',
  games: 'blw:games',
  pas: 'blw:pas',
  pitching: 'blw:pitching',
  livegame: 'blw:livegame',  // single active live game, or null
};

const LOCAL_FILE = path.join('/tmp', 'blw-yard-data.json');

// Detect if Vercel KV is configured
function hasKV() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ============================================================
// LOCAL FALLBACK (file-based, only used in dev without KV)
// ============================================================

async function readLocal() {
  try {
    const text = await fs.readFile(LOCAL_FILE, 'utf-8');
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function writeLocal(data) {
  await fs.writeFile(LOCAL_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// PUBLIC API
// ============================================================

export async function getAllData() {
  if (hasKV()) {
    const [teams, players, games, pas, pitching] = await Promise.all([
      kv.get(STORAGE_KEYS.teams),
      kv.get(STORAGE_KEYS.players),
      kv.get(STORAGE_KEYS.games),
      kv.get(STORAGE_KEYS.pas),
      kv.get(STORAGE_KEYS.pitching),
    ]);
    return {
      teams: teams || null,
      players: players || null,
      games: games || null,
      pas: pas || null,
      pitching: pitching || null,
    };
  }
  // Fallback
  const data = await readLocal();
  return {
    teams: data.teams || null,
    players: data.players || null,
    games: data.games || null,
    pas: data.pas || null,
    pitching: data.pitching || null,
  };
}

export async function setData(key, value) {
  if (!STORAGE_KEYS[key]) throw new Error(`Unknown key: ${key}`);
  if (hasKV()) {
    await kv.set(STORAGE_KEYS[key], value);
    return;
  }
  const data = await readLocal();
  data[key] = value;
  await writeLocal(data);
}

export async function setAll({ teams, players, games, pas, pitching }) {
  if (hasKV()) {
    await Promise.all([
      kv.set(STORAGE_KEYS.teams, teams),
      kv.set(STORAGE_KEYS.players, players),
      kv.set(STORAGE_KEYS.games, games),
      kv.set(STORAGE_KEYS.pas, pas),
      kv.set(STORAGE_KEYS.pitching, pitching),
    ]);
    return;
  }
  await writeLocal({ teams, players, games, pas, pitching });
}

// ============================================================
// LIVE GAME (single active game)
// ============================================================

export async function getLiveGame() {
  if (hasKV()) {
    return (await kv.get(STORAGE_KEYS.livegame)) || null;
  }
  const data = await readLocal();
  return data.livegame || null;
}

export async function setLiveGame(game) {
  if (hasKV()) {
    if (game === null) {
      await kv.del(STORAGE_KEYS.livegame);
    } else {
      await kv.set(STORAGE_KEYS.livegame, game);
    }
    return;
  }
  const data = await readLocal();
  if (game === null) delete data.livegame;
  else data.livegame = game;
  await writeLocal(data);
}
