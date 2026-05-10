import { cookies } from 'next/headers';
import { getAllData, setAll } from '../lib/store';
import {
  DEFAULT_TEAMS, DEFAULT_PLAYERS, DEFAULT_GAMES, DEFAULT_PAS, DEFAULT_PITCHING,
} from '../lib/data';
import Scoreboard from '../components/Scoreboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  let data = await getAllData();

  // Seed if first deploy
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

  // Determine if this visitor is in edit mode based on cookie
  const cookieStore = cookies();
  const editCookie = cookieStore.get('blw_edit')?.value;
  const expectedToken = process.env.EDIT_TOKEN || process.env.EDIT_PASSWORD;
  const canEdit = !!expectedToken && editCookie === expectedToken;

  return <Scoreboard initialData={data} initialCanEdit={canEdit} />;
}
