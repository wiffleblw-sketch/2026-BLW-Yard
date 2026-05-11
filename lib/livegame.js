/**
 * Live game state machine.
 *
 * A live game is a stream of events applied in order to derive the current state.
 * This makes undo trivial (drop last event), enables replay (apply all events),
 * and means concurrent edits can be merged.
 *
 * STATE SHAPE:
 *   {
 *     id, awayTeamId, homeTeamId, date, regulationInnings: 3,
 *     lineups: { away: [playerId...], home: [playerId...] },
 *     starters: { away: pitcherId, home: pitcherId },
 *     events: [Event, ...],  // ordered
 *     status: 'setup' | 'live' | 'final',
 *     startedAt, endedAt,
 *   }
 *
 * EVENT TYPES:
 *   { type: 'pa', batterId, pitcherId, result, advanceRunners?, rbi?, runs?, notes?, ts }
 *   { type: 'pitching_change', team: 'away'|'home', pitcherId, ts }
 *   { type: 'substitution', team, lineupIndex, playerId, ts }
 *   { type: 'manual_advance', from: '1B'|'2B'|'3B'|'home', to: '1B'|'2B'|'3B'|'home'|'out', runnerId, ts }
 *   { type: 'manual_run', team, runnerId?, earned, ts }
 *   { type: 'end_half', ts }   // force end an inning half early
 *   { type: 'end_game', ts }
 *   { type: 'note', text, ts }
 */

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------

export const PA_RESULTS = [
  '1B', '2B', '3B', 'HR', 'BB', 'HBP',
  'K', 'GO', 'FO', 'FC', 'ROE', 'SF',
];

const HIT_CODES = new Set(['1B', '2B', '3B', 'HR']);
const OUT_CODES = new Set(['K', 'GO', 'FO', 'FC', 'SF']);
const FORCE_CODES = new Set(['BB', 'HBP']);
const REACH_NO_OUT = new Set(['1B', '2B', '3B', 'HR', 'BB', 'HBP', 'ROE']);

// ----------------------------------------------------------------------------
// INITIAL STATE
// ----------------------------------------------------------------------------

export function createGame({ id, awayTeamId, homeTeamId, date, regulationInnings = 3 }) {
  return {
    id,
    awayTeamId,
    homeTeamId,
    date,
    regulationInnings,
    lineups: { away: [], home: [] },
    starters: { away: null, home: null },
    events: [],
    status: 'setup',
    startedAt: null,
    endedAt: null,
  };
}

export function setLineup(game, side, playerIds) {
  return { ...game, lineups: { ...game.lineups, [side]: playerIds.slice() } };
}

export function setStarter(game, side, pitcherId) {
  return { ...game, starters: { ...game.starters, [side]: pitcherId } };
}

export function startGame(game) {
  if (!game.lineups.away.length || !game.lineups.home.length) {
    throw new Error('Both lineups must have at least 1 batter');
  }
  if (!game.starters.away || !game.starters.home) {
    throw new Error('Both starting pitchers must be set');
  }
  return { ...game, status: 'live', startedAt: Date.now() };
}

// ----------------------------------------------------------------------------
// DERIVED STATE — compute by replaying events
// ----------------------------------------------------------------------------

export function computeState(game) {
  // Start with fresh state at top of 1st
  const state = {
    inning: 1,
    half: 'T',                                // 'T' or 'B'
    outs: 0,
    score: { away: 0, home: 0 },
    bases: { '1B': null, '2B': null, '3B': null },
    nextBatterIndex: { away: 0, home: 0 },
    currentPitcher: { away: game.starters.away, home: game.starters.home },
    // For stats: per-pitcher per-game outs recorded, earned/unearned runs allowed
    pitching: {},                              // pitcherId -> { outs, r, er, h, bb, k, hr, bf }
    isOver: false,
    lastResult: null,                          // for UI ("just happened")
    runsThisHalf: 0,
    earnedRunsThisHalf: 0,
  };

  for (const ev of game.events) {
    applyEvent(game, state, ev);
    if (state.isOver) break;
  }

  // Convenience derived fields
  state.battingSide = state.half === 'T' ? 'away' : 'home';
  state.fieldingSide = state.half === 'T' ? 'home' : 'away';
  state.currentBatterId = nextBatter(game, state, state.battingSide);
  state.currentPitcherId = state.currentPitcher[state.fieldingSide];

  return state;
}

function nextBatter(game, state, side) {
  const lineup = game.lineups[side];
  if (!lineup.length) return null;
  const idx = state.nextBatterIndex[side] % lineup.length;
  return lineup[idx];
}

function ensurePitcherTracked(state, pitcherId) {
  if (!state.pitching[pitcherId]) {
    state.pitching[pitcherId] = { outs: 0, r: 0, er: 0, h: 0, bb: 0, k: 0, hr: 0, bf: 0 };
  }
  return state.pitching[pitcherId];
}

// Apply a single event in place
function applyEvent(game, state, ev) {
  if (ev.type === 'pitching_change') {
    state.currentPitcher[ev.team] = ev.pitcherId;
    return;
  }
  if (ev.type === 'substitution') {
    // Lineup substitution: replace the player at given slot
    if (game.lineups[ev.team] && ev.lineupIndex < game.lineups[ev.team].length) {
      game.lineups[ev.team][ev.lineupIndex] = ev.playerId;
    }
    return;
  }
  if (ev.type === 'manual_advance') {
    // Move runner from one base to another
    moveRunner(state, ev.from, ev.to, ev.runnerId);
    // Score if moved to home
    if (ev.to === 'home') {
      creditRun(state, ev.runnerId, ev.earned !== false);
    }
    // Out if moved to 'out'
    if (ev.to === 'out') {
      state.outs += 1;
      // charge an out to the current pitcher's IP
      const pid = state.currentPitcher[state.fieldingSide || (state.half === 'T' ? 'home' : 'away')];
      if (pid) {
        const p = ensurePitcherTracked(state, pid);
        p.outs += 1;
      }
      if (state.outs >= 3) advanceHalf(state, game);
    }
    return;
  }
  if (ev.type === 'manual_run') {
    const delta = ev.delta || 1;
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        creditRun(state, ev.runnerId, ev.earned !== false);
      }
      // Remove the runner from their base if they're listed there
      if (ev.runnerId) {
        for (const b of ['1B', '2B', '3B']) {
          if (state.bases[b] === ev.runnerId) {
            state.bases[b] = null;
          }
        }
      }
    } else if (delta < 0) {
      const side = state.half === 'T' ? 'away' : 'home';
      state.score[side] = Math.max(0, state.score[side] + delta);
    }
    return;
  }
  if (ev.type === 'manual_out') {
    // Remove runner from their base, charge an out
    if (ev.fromBase && ev.fromBase !== 'home' && state.bases[ev.fromBase] === ev.runnerId) {
      state.bases[ev.fromBase] = null;
    }
    state.outs += 1;
    const pid = state.currentPitcher[state.half === 'T' ? 'home' : 'away'];
    if (pid) {
      const p = ensurePitcherTracked(state, pid);
      p.outs += 1;
    }
    if (state.outs >= 3) advanceHalf(state, game);
    return;
  }
  if (ev.type === 'end_half') {
    advanceHalf(state, game);
    return;
  }
  if (ev.type === 'end_game') {
    state.isOver = true;
    state.endedReason = 'manual';
    return;
  }
  if (ev.type === 'note') {
    return; // notes don't affect state
  }
  if (ev.type === 'pa') {
    applyPA(game, state, ev);
    return;
  }
}

function applyPA(game, state, ev) {
  const { batterId, pitcherId, result } = ev;
  const battingSide = state.half === 'T' ? 'away' : 'home';
  const fieldingSide = state.half === 'T' ? 'home' : 'away';

  // Track BF
  const pStats = ensurePitcherTracked(state, pitcherId);
  pStats.bf++;

  // Resolve runner movement based on result
  // We use a copy of bases so we can compute new bases without aliasing
  const before = { '1B': state.bases['1B'], '2B': state.bases['2B'], '3B': state.bases['3B'] };
  let after = { '1B': null, '2B': null, '3B': null };
  let runsThisPA = 0;
  let outsThisPA = 0;
  const scorers = [];

  if (result === 'HR') {
    // Everyone scores including batter
    if (before['3B']) { scorers.push(before['3B']); runsThisPA++; }
    if (before['2B']) { scorers.push(before['2B']); runsThisPA++; }
    if (before['1B']) { scorers.push(before['1B']); runsThisPA++; }
    scorers.push(batterId); runsThisPA++;
    pStats.hr++;
    pStats.h++;
  } else if (result === '3B') {
    if (before['3B']) { scorers.push(before['3B']); runsThisPA++; }
    if (before['2B']) { scorers.push(before['2B']); runsThisPA++; }
    if (before['1B']) { scorers.push(before['1B']); runsThisPA++; }
    after['3B'] = batterId;
    pStats.h++;
  } else if (result === '2B') {
    // Default: runner on 1B goes to 3B; runners on 2B/3B score
    if (before['3B']) { scorers.push(before['3B']); runsThisPA++; }
    if (before['2B']) { scorers.push(before['2B']); runsThisPA++; }
    if (before['1B']) { after['3B'] = before['1B']; }
    after['2B'] = batterId;
    pStats.h++;
  } else if (result === '1B') {
    // Default: runner on 1B → 2B, 2B → 3B, 3B → scores
    // ev.advanceRunners can override (e.g. "runner on 1B to 3B")
    if (before['3B']) { scorers.push(before['3B']); runsThisPA++; }
    if (ev.advanceExtra) {
      // Aggressive: all runners advance an extra base
      if (before['2B']) { scorers.push(before['2B']); runsThisPA++; }
      else if (before['1B']) { after['3B'] = before['1B']; }
      if (before['2B'] && before['1B']) { after['3B'] = before['1B']; }
    } else {
      if (before['2B']) { after['3B'] = before['2B']; }
      if (before['1B']) {
        if (after['3B'] === null && !before['2B']) {
          // 1B → 2B is normal
          after['2B'] = before['1B'];
        } else {
          after['2B'] = before['1B'];
        }
      }
    }
    after['1B'] = batterId;
    pStats.h++;
  } else if (result === 'BB' || result === 'HBP') {
    // Force runners only if forced
    pStats[result === 'BB' ? 'bb' : 'bb']++; // count HBP into bb stat? No, leave HBP separate maybe
    if (result === 'BB') { /* counted above */ } 
    // Determine forced advances
    let bumped = batterId;
    // 1B always gets the batter
    if (before['1B']) {
      // 1B forced to 2B
      if (before['2B']) {
        // 2B forced to 3B
        if (before['3B']) {
          // 3B forced home
          scorers.push(before['3B']); runsThisPA++;
        }
        after['3B'] = before['2B'];
      } else {
        after['3B'] = before['3B']; // 3B stays if not forced
        after['2B'] = before['2B']; // null
      }
      after['2B'] = before['1B'];
      after['1B'] = batterId;
    } else {
      after['1B'] = batterId;
      after['2B'] = before['2B'];
      after['3B'] = before['3B'];
    }
  } else if (result === 'ROE') {
    // Reached on error: treat like a 1B for movement but it's an out-less reach
    // Default: batter to 1B, others advance one if forced
    if (before['1B']) {
      if (before['2B']) {
        if (before['3B']) {
          scorers.push(before['3B']); runsThisPA++;
        }
        after['3B'] = before['2B'];
      } else {
        after['3B'] = before['3B'];
      }
      after['2B'] = before['1B'];
    } else {
      after['2B'] = before['2B'];
      after['3B'] = before['3B'];
    }
    after['1B'] = batterId;
  } else if (result === 'K') {
    outsThisPA = 1;
    pStats.k++;
    // Runners stay
    after = { ...before };
  } else if (result === 'GO' || result === 'FO') {
    outsThisPA = 1;
    // Default: runners hold; if advanceRunners flag set, each advances one base
    if (ev.advanceRunners) {
      if (before['3B']) { scorers.push(before['3B']); runsThisPA++; }
      after['3B'] = before['2B'];
      after['2B'] = before['1B'];
    } else {
      after = { ...before };
    }
  } else if (result === 'FC') {
    // Fielders choice: batter to 1B, one runner (lead by default) is out
    outsThisPA = 1;
    if (before['3B']) {
      // Force at home if everyone forced; otherwise lead runner thrown out at next base
      // Simplification: if bases empty before 1B, can't be FC. If 1B occupied, runner from 1B is out at 2B.
      // We'll handle the common cases
      if (before['1B'] && before['2B']) {
        // Bases loaded FC: usually 2B runner out, batter to 1B, 3B runner scores? Depends on play.
        // Simplest: 3B holds, 2B out, 1B to 2B, batter to 1B
        after['3B'] = before['3B'];
        after['2B'] = before['1B'];
        after['1B'] = batterId;
      } else if (before['1B']) {
        after['3B'] = before['3B'];
        after['1B'] = batterId;
      } else {
        // Only 3B → batter to 1B, 3B stays (rare)
        after['3B'] = before['3B'];
        after['1B'] = batterId;
      }
    } else if (before['1B']) {
      after['1B'] = batterId;
      after['2B'] = before['2B']; // null
      // 1B runner is the one out
    } else {
      after['1B'] = batterId;
    }
  } else if (result === 'SF') {
    // Sac fly: 1 out, but if there was a runner on 3B, they score
    outsThisPA = 1;
    if (before['3B']) {
      scorers.push(before['3B']);
      runsThisPA++;
    }
    after = { ...before, '3B': null };
  }

  // Commit base state
  state.bases = after;

  // Credit runs (default: earned)
  for (const runnerId of scorers) {
    creditRun(state, runnerId, true, pitcherId);
  }

  // Credit explicit additional rbi/runs from manual override on the PA
  if (ev.rbi) ev.rbiAttributed = batterId;
  // (rbi/runs from PA are stored on the event itself and used in stat calc)

  // Outs
  state.outs += outsThisPA;
  pStats.outs += outsThisPA;

  // Advance lineup
  state.nextBatterIndex[battingSide] = (state.nextBatterIndex[battingSide] + 1) % game.lineups[battingSide].length;

  state.lastResult = { batterId, pitcherId, result, scorers, outs: outsThisPA, ts: ev.ts };

  // Check half-end at 3 outs
  if (state.outs >= 3) {
    advanceHalf(state, game);
  } else {
    checkGameEnd(state, game);
  }
}

function moveRunner(state, from, to, runnerId) {
  // Remove from origin
  if (from && from !== 'home') {
    if (state.bases[from] === runnerId) state.bases[from] = null;
  }
  // Place at destination (unless out or scored)
  if (to === '1B' || to === '2B' || to === '3B') {
    state.bases[to] = runnerId;
  }
}

function creditRun(state, runnerId, earned, pitcherId = null) {
  const side = state.half === 'T' ? 'away' : 'home';
  state.score[side]++;
  state.runsThisHalf++;
  if (earned) state.earnedRunsThisHalf++;
  // Charge to current pitcher
  const pid = pitcherId || state.currentPitcher[state.half === 'T' ? 'home' : 'away'];
  if (pid) {
    const p = ensurePitcherTracked(state, pid);
    p.r++;
    if (earned) p.er++;
  }
}

function advanceHalf(state, game) {
  state.outs = 0;
  state.bases = { '1B': null, '2B': null, '3B': null };
  state.runsThisHalf = 0;
  state.earnedRunsThisHalf = 0;

  if (state.half === 'T') {
    state.half = 'B';
    // Place runner on 2B in extras for the new half
    if (state.inning > game.regulationInnings) {
      placeExtraRunner(state, game, 'home');
    }
  } else {
    state.half = 'T';
    state.inning++;
    if (state.inning > game.regulationInnings) {
      placeExtraRunner(state, game, 'away');
    }
  }

  checkGameEnd(state, game);
}

function placeExtraRunner(state, game, side) {
  // The runner placed on 2B is the player who batted *last* for this team
  // = the player at (nextBatterIndex[side] - 1) mod lineup length
  const lineup = game.lineups[side];
  if (!lineup.length) return;
  const idx = (state.nextBatterIndex[side] - 1 + lineup.length) % lineup.length;
  state.bases['2B'] = lineup[idx];
}

function checkGameEnd(state, game) {
  // After bottom of regulation (or any later inning), if home team leads, game over
  const completedInnings = state.half === 'T' ? state.inning - 1 : state.inning;
  if (completedInnings >= game.regulationInnings) {
    // If we just finished the top of an inning past regulation and home is ahead, game over
    if (state.half === 'B' && state.inning >= game.regulationInnings && state.score.home > state.score.away) {
      // Mid-bottom: home walks off if they take lead
      state.isOver = true;
      state.endedReason = 'walkoff';
      return;
    }
    // After bottom of inning past regulation, check for not tied
    if (state.half === 'T' && state.inning > game.regulationInnings && state.score.home !== state.score.away) {
      state.isOver = true;
      state.endedReason = 'regulation';
      return;
    }
    // Top is starting (state.half === 'T') and inning > regulation means we just finished a bottom
    // If after that the scores differ, end
    if (state.half === 'T' && state.score.away !== state.score.home && state.inning > game.regulationInnings) {
      state.isOver = true;
      state.endedReason = 'extras';
      return;
    }
  }
}

// ----------------------------------------------------------------------------
// EVENT BUILDERS (for the UI to add events)
// ----------------------------------------------------------------------------

let _evCounter = 0;
function evId() { return `e${Date.now()}${++_evCounter}`; }

export function paEvent({ batterId, pitcherId, result, advanceRunners, advanceExtra, rbi, notes }) {
  return {
    id: evId(),
    type: 'pa',
    batterId, pitcherId, result,
    advanceRunners: !!advanceRunners,
    advanceExtra: !!advanceExtra,
    rbi: rbi || 0,
    notes: notes || '',
    ts: Date.now(),
  };
}

export function pitchingChangeEvent({ team, pitcherId }) {
  return { id: evId(), type: 'pitching_change', team, pitcherId, ts: Date.now() };
}

export function substitutionEvent({ team, lineupIndex, playerId }) {
  return { id: evId(), type: 'substitution', team, lineupIndex, playerId, ts: Date.now() };
}

export function endHalfEvent() {
  return { id: evId(), type: 'end_half', ts: Date.now() };
}

export function endGameEvent() {
  return { id: evId(), type: 'end_game', ts: Date.now() };
}

// Manual adjustments — used when the default smart engine got something wrong.
// These are appended to the event stream like any other event.

// Move a runner from one base to another (or to home = score, or to 'out' = call out)
export function manualAdvanceEvent({ runnerId, from, to, earned = true }) {
  return { id: evId(), type: 'manual_advance', runnerId, from, to, earned, ts: Date.now() };
}

// Add an extra run (e.g. wild pitch scored a runner, balk, etc.)
// or subtract one (set delta to -1) — used when the engine missed something.
export function manualRunEvent({ runnerId, earned = true, delta = 1 }) {
  return { id: evId(), type: 'manual_run', runnerId, earned, delta, ts: Date.now() };
}

// Add an out without a PA (e.g., runner thrown out stealing, picked off)
export function manualOutEvent({ runnerId, fromBase }) {
  return { id: evId(), type: 'manual_out', runnerId, fromBase, ts: Date.now() };
}

// ----------------------------------------------------------------------------
// CONVERT FINISHED LIVE GAME TO SEASON STATS
// ----------------------------------------------------------------------------

/**
 * When a live game ends, convert its events into:
 *  - one entry in `games`
 *  - PA rows in `pas`
 *  - pitching line rows in `pitching`
 *
 * This way the live game seamlessly joins the season stats.
 */
export function finalizeToSeasonRecords(game) {
  const state = computeState(game);

  const innings = Math.max(game.regulationInnings, state.inning);
  const gameRecord = {
    id: game.id,
    date: game.date,
    awayTeamId: game.awayTeamId,
    homeTeamId: game.homeTeamId,
    innings,
    status: 'final',
    notes: state.endedReason === 'walkoff' ? 'Walk-off' : (state.endedReason === 'extras' ? 'Extras' : ''),
  };

  // Build PA rows from events
  const pas = [];
  // Replay to determine inning/half at time of each PA
  const replayState = {
    inning: 1, half: 'T', outs: 0,
    score: { away: 0, home: 0 },
    bases: { '1B': null, '2B': null, '3B': null },
    nextBatterIndex: { away: 0, home: 0 },
    currentPitcher: { away: game.starters.away, home: game.starters.home },
    pitching: {},
    isOver: false,
    runsThisHalf: 0, earnedRunsThisHalf: 0,
  };
  let paIndex = 0;
  for (const ev of game.events) {
    if (ev.type === 'pa') {
      const inning = replayState.inning;
      const half = replayState.half;
      // Determine runs scored by this batter (if they scored after this PA — tracked in lastResult)
      // Simple: a batter "scored" if they crossed home in this PA (only happens on HR)
      const batterScored = ev.result === 'HR' ? 1 : 0;
      // RBIs: count scorers attributable to this PA
      // For our simplified model, use rbi from event or fall back to scorers count
      pas.push({
        id: `pa-${game.id}-${paIndex++}`,
        gameId: game.id,
        inning,
        half,
        batterId: ev.batterId,
        pitcherId: ev.pitcherId,
        result: ev.result,
        rbi: ev.rbi || 0,
        runs: batterScored,
        notes: ev.notes || '',
      });
    }
    applyEvent(game, replayState, ev);
    if (replayState.isOver) break;
  }

  // Build pitching lines from the per-pitcher tracked stats
  const finalState = computeState(game);
  const pitchingLines = [];
  // Track started flag and W/L/SV decisions (simple: starter who finished gets credit when team won)
  const startersSet = new Set([game.starters.away, game.starters.home]);
  let lineIdx = 0;
  for (const [pid, st] of Object.entries(finalState.pitching)) {
    const isStarter = startersSet.has(pid);
    const ip = st.outs / 3;
    pitchingLines.push({
      id: `pit-${game.id}-${lineIdx++}`,
      gameId: game.id,
      pitcherId: pid,
      gs: isStarter ? 1 : 0,
      ip: Math.floor(ip) + ((st.outs % 3) / 10), // 4.1 = 4+1/3 etc.
      r: st.r,
      er: st.er,
      h: st.h,
      bb: st.bb,
      k: st.k,
      hr: st.hr,
      cg: 0, w: 0, l: 0, s: 0, // decisions left manual or 0
      notes: '',
    });
  }

  return { gameRecord, pas, pitchingLines, finalState };
}
