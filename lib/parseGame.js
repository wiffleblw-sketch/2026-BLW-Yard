/**
 * Parse a pasted game script (like a scorekeeper's notes) into a structured game.
 *
 * Input format (flexible — handles many variations):
 *
 *   Top 1
 *   Luke Rose Pitching
 *   Keaton Kimmel: K
 *   Mateo Sanchez: 1B
 *   Tom Jankowski: K
 *   Bot 1
 *   Kimmel Pitching
 *   Jonathan Dalbey: 1B
 *   Logan Rose: 1B (runner advanced one base)
 *   Luke Rose: K
 *   ...
 *
 * Output:
 *   {
 *     events: [...],          // ordered events ready to feed to game state machine
 *     awayLineup: [pid...],   // derived from order of T1/T2/... PAs
 *     homeLineup: [pid...],
 *     awayStarter: pid,
 *     homeStarter: pid,
 *     warnings: [string],     // non-fatal issues
 *     errors: [string],       // blocking issues
 *     finalScore: { away, home } | null,  // if mentioned in input
 *     parsedPlays: [...],     // for preview (includes inning/half/batter name/result)
 *   }
 */

// ---------- result code aliases ----------
const RESULT_ALIASES = {
  'k': 'K',
  'strikeout': 'K',
  'strike out': 'K',
  'strike out swinging': 'K',
  'strike out looking': 'K',
  'so': 'K',
  '1b': '1B',
  'single': '1B',
  '2b': '2B',
  'double': '2B',
  '3b': '3B',
  'triple': '3B',
  'hr': 'HR',
  'home run': 'HR',
  'homer': 'HR',
  'inside the park hr': 'HR',
  'inside-the-park hr': 'HR',
  'bb': 'BB',
  'walk': 'BB',
  'base on balls': 'BB',
  'hbp': 'HBP',
  'hit by pitch': 'HBP',
  'fc': 'FC',
  "fielder's choice": 'FC',
  'fielders choice': 'FC',
  'go': 'GO',
  'groundout': 'GO',
  'ground out': 'GO',
  'ground-out': 'GO',
  'fo': 'FO',
  'flyout': 'FO',
  'fly out': 'FO',
  'fly-out': 'FO',
  'popout': 'FO',
  'pop out': 'FO',
  'pop-out': 'FO',
  'lineout': 'FO',
  'line out': 'FO',
  'line-out': 'FO',
  'roe': 'ROE',
  'reached on error': 'ROE',
  'reach on error': 'ROE',
  'error': 'ROE',
  'sf': 'SF',
  'sac fly': 'SF',
  'sacrifice fly': 'SF',
};

// ---------- helpers ----------

function normalizeStr(s) {
  return s.toLowerCase().trim().replace(/[.,;]+$/g, '');
}

// Match a player from a name string (full or partial) against the team's roster.
// Returns { player, ambiguous: bool } or null.
function matchPlayer(nameStr, roster) {
  const q = normalizeStr(nameStr);
  if (!q) return null;

  // Exact full-name match
  let matches = roster.filter(p => normalizeStr(p.name) === q);
  if (matches.length === 1) return { player: matches[0], ambiguous: false };

  // Last name exact match
  matches = roster.filter(p => {
    const parts = p.name.split(/\s+/);
    const last = normalizeStr(parts[parts.length - 1]);
    return last === q;
  });
  if (matches.length === 1) return { player: matches[0], ambiguous: false };
  if (matches.length > 1) return { player: matches[0], ambiguous: true, candidates: matches };

  // First name exact match
  matches = roster.filter(p => {
    const parts = p.name.split(/\s+/);
    return normalizeStr(parts[0]) === q;
  });
  if (matches.length === 1) return { player: matches[0], ambiguous: false };
  if (matches.length > 1) return { player: matches[0], ambiguous: true, candidates: matches };

  // Substring match in full name
  matches = roster.filter(p => normalizeStr(p.name).includes(q));
  if (matches.length === 1) return { player: matches[0], ambiguous: false };
  if (matches.length > 1) return { player: matches[0], ambiguous: true, candidates: matches };

  return null;
}

// Parse a result string. May include "RBI" prefix and result code.
// "1B" -> { result: '1B', rbi: 0 }
// "RBI 1B" -> { result: '1B', rbi: 1 }
// "2 RBI 2B" -> { result: '2B', rbi: 2 }
// "3 RBI inside the park HR" -> { result: 'HR', rbi: 3 }
// "Groundout" -> { result: 'GO', rbi: 0 }
// "1B (runner advanced one base)" -> { result: '1B', rbi: 0, notes: 'runner advanced one base' }
function parseResultPart(text) {
  // Extract parenthetical notes first
  let notes = '';
  const noteMatch = text.match(/\(([^)]*)\)/);
  if (noteMatch) {
    notes = noteMatch[1].trim();
    text = text.replace(/\([^)]*\)/g, '').trim();
  }

  let rbi = 0;
  let work = text.trim();

  // Check for "N RBI" or "RBI"
  const rbiMatch = work.match(/^(\d+)\s+rbi\b\s*(.*)$/i);
  if (rbiMatch) {
    rbi = parseInt(rbiMatch[1], 10);
    work = rbiMatch[2].trim();
  } else {
    const rbiMatch2 = work.match(/^rbi\s+(.*)$/i);
    if (rbiMatch2) {
      rbi = 1;
      work = rbiMatch2[1].trim();
    }
  }

  // Also check "result RBI N" trailing
  if (!rbi) {
    const trailRbi = work.match(/^(.+?)\s+(\d+)\s+rbi\b\s*$/i);
    if (trailRbi) {
      rbi = parseInt(trailRbi[2], 10);
      work = trailRbi[1].trim();
    } else {
      const trailRbi2 = work.match(/^(.+?)\s+rbi\b\s*$/i);
      if (trailRbi2) {
        rbi = 1;
        work = trailRbi2[1].trim();
      }
    }
  }

  // Now try to match the result code (try longest matches first)
  const normalized = work.toLowerCase();
  const aliasKeys = Object.keys(RESULT_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of aliasKeys) {
    if (normalized === key) return { result: RESULT_ALIASES[key], rbi, notes };
  }
  // Try splitting and matching first token(s)
  for (const key of aliasKeys) {
    if (normalized.startsWith(key + ' ') || normalized === key) {
      const rest = work.slice(key.length).trim();
      if (rest) notes = notes ? `${notes}; ${rest}` : rest;
      return { result: RESULT_ALIASES[key], rbi, notes };
    }
  }

  return { result: null, rbi, notes, raw: work };
}

// Detect inning/half headers like "Top 1", "T1", "Bot 2", "B3", "Bottom 3", "Top 1st"
function parseInningHeader(line) {
  const m = line.match(/^\s*(top|t|bot|bottom|b)\s*(\d+)(?:st|nd|rd|th)?\s*$/i);
  if (!m) return null;
  const halfWord = m[1].toLowerCase();
  const half = (halfWord === 'top' || halfWord === 't') ? 'T' : 'B';
  return { inning: parseInt(m[2], 10), half };
}

// Detect a "Pitching" line. Matches:
//   "Luke Rose Pitching"
//   "Kimmel Pitching"
//   "Luke Pitching:"
//   "Kimmel comes in"
//   "Logan Rose in to pitch"
//   "Logan Rose to pitch"
function parsePitchingLine(line) {
  // Pattern 1: "Name(s) Pitching" or "Name(s) Pitching:"
  let m = line.match(/^\s*(.+?)\s+pitching\s*:?\s*$/i);
  if (m) return m[1].trim();
  // Pattern 2: "Name(s) comes in"
  m = line.match(/^\s*(.+?)\s+comes?\s+in\b/i);
  if (m) return m[1].trim();
  // Pattern 3: "Name(s) in to pitch" / "Name(s) to pitch"
  m = line.match(/^\s*(.+?)\s+(?:in\s+)?to\s+pitch\b/i);
  if (m) return m[1].trim();
  return null;
}

// Parse a PA line: "Name: result" or "Name:result"
function parsePALine(line) {
  const m = line.match(/^\s*([^:]+):\s*(.+?)\s*$/);
  if (!m) return null;
  return { name: m[1].trim(), resultText: m[2].trim() };
}

// Parse a final-score line like "6-0 Wolves" or "Diamonds win 4-3"
function parseFinalScore(line) {
  const m1 = line.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s+(\w+)/i);
  if (m1) {
    return { score1: parseInt(m1[1]), score2: parseInt(m1[2]), team: m1[3] };
  }
  const m2 = line.match(/^\s*(\w+)\s+wins?\s+(\d+)\s*[-–]\s*(\d+)/i);
  if (m2) {
    return { team: m2[1], score1: parseInt(m2[2]), score2: parseInt(m2[3]) };
  }
  return null;
}

// ---------- main parser ----------

export function parseGameScript({
  text,
  awayTeam,        // { id, name, abbr, ... }
  homeTeam,
  awayRoster,      // [{id, name, teamId}, ...]
  homeRoster,
  date,
}) {
  const errors = [];
  const warnings = [];
  const parsedPlays = [];   // for preview UI
  const events = [];        // for state machine

  let currentInning = 0;
  let currentHalf = null;   // 'T' or 'B'
  let currentBattingRoster = null;   // roster of team batting now
  let currentFieldingRoster = null;
  let awayCurrentPitcher = null;     // player id
  let homeCurrentPitcher = null;
  let awayLineupSeen = [];           // PA order, dedupe-aware
  let homeLineupSeen = [];
  let finalScore = null;

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let evCounter = 0;
  const newId = () => `pev-${Date.now()}-${++evCounter}`;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // 1. Try inning header
    const inHdr = parseInningHeader(line);
    if (inHdr) {
      currentInning = inHdr.inning;
      currentHalf = inHdr.half;
      if (currentHalf === 'T') {
        currentBattingRoster = awayRoster;
        currentFieldingRoster = homeRoster;
      } else {
        currentBattingRoster = homeRoster;
        currentFieldingRoster = awayRoster;
      }
      continue;
    }

    // 2. Try pitching change line
    const pitcherName = parsePitchingLine(line);
    if (pitcherName) {
      if (!currentFieldingRoster) {
        // Pitching announcement before any inning header — assume this is the starter
        // First pitcher mentioned = away starter (top of 1 begins game, home pitches in top)
        // But user format is often "Top 1 / [Away Pitcher Name] Pitching" — name is the FIELDING pitcher (home)
        // Heuristic: if no inning yet, this is probably a header we'll set when first inning appears
        // We'll set both starters from first two pitching lines
        // For now stash it
        if (!awayCurrentPitcher && !homeCurrentPitcher) {
          // First pitcher mentioned — could be either. We'll resolve when first PA arrives.
          // Easier: most game scripts put "Top 1 / [Pitcher] Pitching" meaning the home team pitcher.
          // So default this to home pitcher.
          const match = matchPlayer(pitcherName, homeRoster);
          if (match) {
            homeCurrentPitcher = match.player.id;
            continue;
          }
          const match2 = matchPlayer(pitcherName, awayRoster);
          if (match2) {
            awayCurrentPitcher = match2.player.id;
            continue;
          }
          warnings.push(`Could not match pitcher "${pitcherName}" to either roster`);
          continue;
        }
      }
      // Match against the fielding team's roster
      const match = matchPlayer(pitcherName, currentFieldingRoster);
      if (!match) {
        warnings.push(`Could not match pitcher "${pitcherName}" on fielding team`);
        continue;
      }
      if (match.ambiguous) {
        warnings.push(`Ambiguous pitcher name "${pitcherName}" — picked ${match.player.name}`);
      }
      const side = currentHalf === 'T' ? 'home' : 'away';
      if (side === 'home') homeCurrentPitcher = match.player.id;
      else awayCurrentPitcher = match.player.id;

      // Only emit a pitching_change event if this isn't the very first pitcher for that side
      // (the first one becomes the starter, no event needed)
      // For simplicity always emit; the consumer can decide
      events.push({
        id: newId(),
        type: 'pitching_change',
        team: side,
        pitcherId: match.player.id,
        ts: events.length,
      });
      continue;
    }

    // 3. Try final score line
    const fs = parseFinalScore(line);
    if (fs) {
      finalScore = fs;
      continue;
    }
    // Also skip "Game N" headers
    if (/^\s*game\s+\d+\s*$/i.test(line)) continue;

    // 4. Try PA line
    const pa = parsePALine(line);
    if (pa) {
      if (!currentBattingRoster) {
        errors.push(`Line ${lineIdx + 1}: PA "${line}" appears before any inning header`);
        continue;
      }
      const batterMatch = matchPlayer(pa.name, currentBattingRoster);
      if (!batterMatch) {
        errors.push(`Line ${lineIdx + 1}: could not match batter "${pa.name}" on batting team`);
        continue;
      }
      if (batterMatch.ambiguous) {
        warnings.push(`Line ${lineIdx + 1}: ambiguous batter "${pa.name}" — picked ${batterMatch.player.name}`);
      }
      const parsed = parseResultPart(pa.resultText);
      if (!parsed.result) {
        errors.push(`Line ${lineIdx + 1}: could not parse result "${pa.resultText}"`);
        continue;
      }

      // Track lineup order — first time we see a player in the game, add to lineup
      const battingSide = currentHalf === 'T' ? 'away' : 'home';
      const lineupArr = battingSide === 'away' ? awayLineupSeen : homeLineupSeen;
      if (!lineupArr.includes(batterMatch.player.id)) {
        lineupArr.push(batterMatch.player.id);
      }

      // Pitcher for this PA: opposing team's current pitcher
      const pitcherId = battingSide === 'away' ? homeCurrentPitcher : awayCurrentPitcher;
      if (!pitcherId) {
        warnings.push(`Line ${lineIdx + 1}: no pitcher established for ${battingSide === 'away' ? 'home' : 'away'} team`);
      }

      const ev = {
        id: newId(),
        type: 'pa',
        batterId: batterMatch.player.id,
        pitcherId: pitcherId || null,
        result: parsed.result,
        rbi: parsed.rbi,
        notes: parsed.notes || '',
        advanceRunners: false,
        ts: events.length,
      };
      events.push(ev);

      parsedPlays.push({
        inning: currentInning,
        half: currentHalf,
        batterName: batterMatch.player.name,
        result: parsed.result,
        rbi: parsed.rbi,
        notes: parsed.notes,
        line: line,
      });
      continue;
    }

    // Otherwise — note it but don't fail
    if (line.length > 0) {
      warnings.push(`Line ${lineIdx + 1}: unrecognized line "${line}"`);
    }
  }

  // Validation
  if (parsedPlays.length === 0) {
    errors.push('No plays parsed. Check the format — needs "Top N" / "Bot N" headers and "Name: result" lines.');
  }

  // If a starter was never set, try to grab from currentPitcher state
  const awayStarter = events.find(e => e.type === 'pitching_change' && e.team === 'away')?.pitcherId
    || awayCurrentPitcher
    || null;
  const homeStarter = events.find(e => e.type === 'pitching_change' && e.team === 'home')?.pitcherId
    || homeCurrentPitcher
    || null;

  if (!awayStarter) warnings.push('Away starter not detected — assuming first pitcher in PAs');
  if (!homeStarter) warnings.push('Home starter not detected — assuming first pitcher in PAs');

  return {
    events,
    awayLineup: awayLineupSeen,
    homeLineup: homeLineupSeen,
    awayStarter,
    homeStarter,
    awayTeamId: awayTeam.id,
    homeTeamId: homeTeam.id,
    date,
    warnings,
    errors,
    parsedPlays,
    finalScore,
  };
}
