/**
 * Pure data + math, no UI dependencies.
 * Imported by both server (API routes, page) and client (components).
 */

export const SEASON_LABEL = 'SEASON 7 · 2026';
export const LEAGUE_TITLE = 'BLW\u2002YARD';
export const LEAGUE_SUB = 'Big League Wiffleball';

export const RESULT_CODES = [
  { code: 'K', label: 'Strikeout' },
  { code: 'BB', label: 'Walk' },
  { code: 'HBP', label: 'Hit by pitch' },
  { code: '1B', label: 'Single' },
  { code: '2B', label: 'Double' },
  { code: '3B', label: 'Triple' },
  { code: 'HR', label: 'Home run' },
  { code: 'GO', label: 'Ground out' },
  { code: 'FO', label: 'Fly/line/pop out' },
  { code: 'FC', label: "Fielder's choice" },
  { code: 'ROE', label: 'Reached on error' },
  { code: 'SF', label: 'Sac fly' },
];

// Seed data — only used when KV is empty (first deploy)
export const DEFAULT_TEAMS = [
  { id: 'cougars',  name: 'Coastal Cougars',  abbr: 'COA', primary: '#1D4ED8', city: 'Coastal',  logoKey: 'cougars'  },
  { id: 'diamonds', name: 'Desert Diamonds',  abbr: 'DES', primary: '#DC2626', city: 'Desert',   logoKey: 'diamonds' },
  { id: 'wolves',   name: 'Western Wolves',   abbr: 'WLV', primary: '#EAB308', city: 'Western',  logoKey: 'wolves'   },
  { id: 'panthers', name: 'Pacific Panthers', abbr: 'PAN', primary: '#EA580C', city: 'Pacific',  logoKey: 'panthers' },
];

export const DEFAULT_PLAYERS = [
  // Coastal Cougars
  { id: 'p1', name: 'Randy Dalbey',     teamId: 'cougars' },
  { id: 'p2', name: 'Jackson Albers',   teamId: 'cougars' },
  { id: 'p3', name: 'Aneas Sandoval',   teamId: 'cougars' },
  { id: 'p4', name: 'Easton Miranda',   teamId: 'cougars' },
  { id: 'p5', name: 'Chris Sandoval',   teamId: 'cougars' },
  { id: 'p9', name: 'Henry Stratton',   teamId: 'cougars' },

  // Desert Diamonds
  { id: 'p6',  name: 'Keaton Kimmel',     teamId: 'diamonds' },
  { id: 'p7',  name: 'Noah Casale',       teamId: 'diamonds' },
  { id: 'p8',  name: 'Mateo Sanchez',     teamId: 'diamonds' },
  { id: 'p10', name: 'Tommy Hernandez',   teamId: 'diamonds' },
  { id: 'p11', name: 'Tom Jankowski',     teamId: 'diamonds' },
  { id: 'p12', name: 'Jake Isaackson',    teamId: 'diamonds' },

  // Western Wolves
  { id: 'p13', name: 'Logan Rose',        teamId: 'wolves' },
  { id: 'p14', name: 'Luke Rose',         teamId: 'wolves' },
  { id: 'p15', name: 'Jonathan Dalbey',   teamId: 'wolves' },
  { id: 'p16', name: 'Tom Ulrich',        teamId: 'wolves' },
  { id: 'p17', name: 'Ronnie Ross',       teamId: 'wolves' },

  // Pacific Panthers
  { id: 'p18', name: 'Carson Rose',       teamId: 'panthers' },
  { id: 'p19', name: 'Andrew Ledet',      teamId: 'panthers' },
  { id: 'p20', name: 'Trevor Bauer',      teamId: 'panthers' },
  { id: 'p21', name: 'Joey Jankowski',    teamId: 'panthers' },
  { id: 'p22', name: 'Reid Umar',         teamId: 'panthers' },
];

// TEAM_PRESETS is now empty since all 4 teams are pre-loaded.
// Kept as an empty array so the "Add Team" UI's preset section still works for any future teams.
export const TEAM_PRESETS = [];

// Seed games + plays + pitching
// Player IDs reference: cougars p1-p5, p9; diamonds p6-p8, p10-p12; wolves p13-p17; panthers p18-p22.
export const DEFAULT_GAMES = [
  // 2026-05-09: Coastal Cougars vs Desert Diamonds
  { id: 'g1', date: '2026-05-09', awayTeamId: 'cougars', homeTeamId: 'diamonds', innings: 4, status: 'final', notes: 'Walk-off in extras' },
  { id: 'g2', date: '2026-05-09', awayTeamId: 'cougars', homeTeamId: 'diamonds', innings: 3, status: 'final', notes: '' },
  { id: 'g3', date: '2026-05-09', awayTeamId: 'cougars', homeTeamId: 'diamonds', innings: 4, status: 'final', notes: 'Big top of 4th' },
  // 2026-05-10: Desert Diamonds vs Western Wolves
  { id: 'g4', date: '2026-05-10', awayTeamId: 'diamonds', homeTeamId: 'wolves',   innings: 3, status: 'final', notes: 'Luke Rose CG shutout; 3-run HR' },
  { id: 'g5', date: '2026-05-10', awayTeamId: 'wolves',   homeTeamId: 'diamonds', innings: 3, status: 'final', notes: 'Diamonds walk-off; Isaackson bases-loaded BB' },
  { id: 'g6', date: '2026-05-10', awayTeamId: 'diamonds', homeTeamId: 'wolves',   innings: 3, status: 'final', notes: 'Sanchez & Kimmel back-to-back HRs in T3' },
];

let _paId = 0;
const mkPA = (gameId, inning, half, batter, pitcher, result, rbi = 0, runs = 0, notes = '') => ({
  id: `pa${++_paId}`, gameId, inning, half, batterId: batter, pitcherId: pitcher,
  result, rbi, runs, notes,
});

export const DEFAULT_PAS = [
  mkPA('g1',1,'T','p1','p6','K'), mkPA('g1',1,'T','p2','p6','1B'), mkPA('g1',1,'T','p3','p6','K'), mkPA('g1',1,'T','p4','p6','BB'), mkPA('g1',1,'T','p1','p6','K'),
  mkPA('g1',1,'B','p6','p2','BB'), mkPA('g1',1,'B','p7','p2','BB'), mkPA('g1',1,'B','p8','p2','K'), mkPA('g1',1,'B','p6','p2','K'), mkPA('g1',1,'B','p7','p2','K'),
  mkPA('g1',2,'T','p2','p6','K'), mkPA('g1',2,'T','p3','p6','K'), mkPA('g1',2,'T','p4','p6','BB'), mkPA('g1',2,'T','p1','p6','1B'), mkPA('g1',2,'T','p2','p6','K'),
  mkPA('g1',2,'B','p8','p2','3B'), mkPA('g1',2,'B','p6','p2','K'), mkPA('g1',2,'B','p7','p2','K'), mkPA('g1',2,'B','p8','p2','GO'),
  mkPA('g1',3,'T','p3','p6','K'), mkPA('g1',3,'T','p4','p6','K'), mkPA('g1',3,'T','p1','p6','K'),
  mkPA('g1',3,'B','p6','p2','GO'), mkPA('g1',3,'B','p7','p2','GO'), mkPA('g1',3,'B','p8','p2','BB'), mkPA('g1',3,'B','p6','p2','K'),
  mkPA('g1',4,'T','p2','p6','BB',0,0,'extra-inn runner on 2B'), mkPA('g1',4,'T','p3','p6','K'), mkPA('g1',4,'T','p4','p6','BB'), mkPA('g1',4,'T','p1','p6','K'), mkPA('g1',4,'T','p2','p6','FC'),
  mkPA('g1',4,'B','p7','p2','K',0,0,'extra-inn runner placed'), mkPA('g1',4,'B','p8','p2','1B',0,1,'placed runner scored'), mkPA('g1',4,'B','p6','p2','K'), mkPA('g1',4,'B','p7','p2','1B',1,0,'walk-off RBI'),
  mkPA('g2',1,'T','p6','p1','K'), mkPA('g2',1,'T','p7','p1','K'), mkPA('g2',1,'T','p8','p1','K'),
  mkPA('g2',1,'B','p1','p7','1B'), mkPA('g2',1,'B','p2','p7','1B'), mkPA('g2',1,'B','p3','p7','K'), mkPA('g2',1,'B','p5','p7','K'), mkPA('g2',1,'B','p1','p7','1B'), mkPA('g2',1,'B','p2','p7','K'),
  mkPA('g2',2,'T','p6','p1','GO'), mkPA('g2',2,'T','p7','p1','HR',1,1), mkPA('g2',2,'T','p8','p1','BB'), mkPA('g2',2,'T','p6','p1','K'), mkPA('g2',2,'T','p7','p1','GO'),
  mkPA('g2',2,'B','p3','p7','1B'), mkPA('g2',2,'B','p5','p7','GO',0,0,'runner out trying 3B'), mkPA('g2',2,'B','p1','p7','HR',1,1), mkPA('g2',2,'B','p2','p7','1B'), mkPA('g2',2,'B','p3','p7','GO'),
  mkPA('g2',3,'T','p8','p1','2B',0,1,'scored on Casale 2B'), mkPA('g2',3,'T','p6','p1','K'), mkPA('g2',3,'T','p7','p1','2B',1,0), mkPA('g2',3,'T','p8','p1','GO'), mkPA('g2',3,'T','p6','p1','K'),
  mkPA('g2',3,'B','p5','p6','BB'), mkPA('g2',3,'B','p1','p6','1B'), mkPA('g2',3,'B','p2','p6','FC'), mkPA('g2',3,'B','p3','p6','K'), mkPA('g2',3,'B','p5','p6','K'),
  mkPA('g3',1,'T','p1','p8','FO',0,0,'pop out'), mkPA('g3',1,'T','p2','p8','K'), mkPA('g3',1,'T','p3','p8','1B'), mkPA('g3',1,'T','p5','p8','GO'),
  mkPA('g3',1,'B','p6','p2','HR',1,1), mkPA('g3',1,'B','p7','p2','K'), mkPA('g3',1,'B','p8','p2','K'), mkPA('g3',1,'B','p6','p2','BB'), mkPA('g3',1,'B','p7','p2','K'),
  mkPA('g3',2,'T','p1','p8','1B'), mkPA('g3',2,'T','p2','p8','BB'), mkPA('g3',2,'T','p3','p8','BB'), mkPA('g3',2,'T','p5','p8','BB',1,0,'bases-loaded walk'),
  mkPA('g3',2,'T','p1','p6','K'), mkPA('g3',2,'T','p2','p6','K'), mkPA('g3',2,'T','p3','p6','FC'),
  mkPA('g3',2,'B','p8','p2','K'), mkPA('g3',2,'B','p6','p2','K'), mkPA('g3',2,'B','p7','p2','K'),
  mkPA('g3',3,'T','p5','p6','K'), mkPA('g3',3,'T','p1','p6','1B'), mkPA('g3',3,'T','p2','p6','K'), mkPA('g3',3,'T','p3','p6','BB'), mkPA('g3',3,'T','p5','p6','K'),
  mkPA('g3',3,'B','p8','p2','K'), mkPA('g3',3,'B','p6','p2','K'), mkPA('g3',3,'B','p7','p2','1B'), mkPA('g3',3,'B','p8','p2','K'),
  mkPA('g3',4,'T','p1','p6','3B',1,1,'extra-inn runner; Dalbey scored'), mkPA('g3',4,'T','p2','p6','FO',0,0,'line out'), mkPA('g3',4,'T','p3','p6','K'), mkPA('g3',4,'T','p5','p6','BB'),
  mkPA('g3',4,'T','p1','p6','3B',2,1), mkPA('g3',4,'T','p2','p6','1B',1,1), mkPA('g3',4,'T','p4','p6','BB',0,0,'in for A.Sandoval'), mkPA('g3',4,'T','p5','p6','K'),
  mkPA('g3',4,'B','p6','p2','1B',0,0,'extra-inn placed runner'), mkPA('g3',4,'B','p7','p2','K'), mkPA('g3',4,'B','p8','p2','K'), mkPA('g3',4,'B','p6','p2','K'),

  // ============================================================
  // GAME 4 (2026-05-10): Diamonds @ Wolves, Wolves win 6-0
  // Pitchers: Diamonds = Kimmel (p6); Wolves = Luke Rose (p14)
  // Diamonds lineup: Kimmel(p6), Sanchez(p8), Jankowski(p11), Isaackson(p12)
  // Wolves lineup: Dalbey(p15), L.Rose(p13), Luke(p14), Ulrich(p16), Ross(p17)
  // ============================================================
  // T1 — vs Luke
  mkPA('g4',1,'T','p6','p14','K'),
  mkPA('g4',1,'T','p8','p14','K'),
  mkPA('g4',1,'T','p11','p14','K'),
  // B1 — vs Kimmel
  mkPA('g4',1,'B','p15','p6','1B'),
  mkPA('g4',1,'B','p13','p6','1B',0,0,'runner advanced'),
  mkPA('g4',1,'B','p14','p6','K'),
  mkPA('g4',1,'B','p16','p6','K'),
  mkPA('g4',1,'B','p17','p6','1B',1,0,'RBI; Dalbey scored'),
  mkPA('g4',1,'B','p15','p6','K'),
  // T2 — vs Luke
  mkPA('g4',2,'T','p12','p14','K'),
  mkPA('g4',2,'T','p6','p14','1B'),
  mkPA('g4',2,'T','p8','p14','K'),
  mkPA('g4',2,'T','p11','p14','FC',0,0,'Kimmel out at 3rd'),
  // B2 — vs Kimmel
  mkPA('g4',2,'B','p13','p6','BB'),
  mkPA('g4',2,'B','p14','p6','1B'),
  mkPA('g4',2,'B','p16','p6','1B'),
  mkPA('g4',2,'B','p17','p6','K'),
  mkPA('g4',2,'B','p15','p6','1B',2,0,'2-RBI single; L.Rose & Luke score'),
  mkPA('g4',2,'B','p13','p6','K'),
  mkPA('g4',2,'B','p14','p6','HR',3,1,'3-RBI inside-the-park HR'),
  mkPA('g4',2,'B','p16','p6','K'),
  // T3 — vs Luke (no B3 needed; home team leads)
  mkPA('g4',3,'T','p12','p14','BB'),
  mkPA('g4',3,'T','p6','p14','BB'),
  mkPA('g4',3,'T','p8','p14','K'),
  mkPA('g4',3,'T','p11','p14','K'),
  mkPA('g4',3,'T','p12','p14','K'),

  // ============================================================
  // GAME 5 (2026-05-10): Wolves @ Diamonds, Diamonds win 4-3 (walk-off)
  // Pitchers: Wolves = Luke (p14) starts, Logan (p13) relieves T3; Diamonds = Sanchez (p8) starts, Kimmel (p6) relieves T3
  // ============================================================
  // T1 — vs Sanchez
  mkPA('g5',1,'T','p15','p8','BB'),
  mkPA('g5',1,'T','p13','p8','BB'),
  mkPA('g5',1,'T','p14','p8','BB',0,0,'bases loaded'),
  mkPA('g5',1,'T','p16','p8','K'),
  mkPA('g5',1,'T','p17','p8','K'),
  mkPA('g5',1,'T','p15','p8','GO'),
  // B1 — vs Luke
  mkPA('g5',1,'B','p6','p14','K'),
  mkPA('g5',1,'B','p8','p14','1B'),
  mkPA('g5',1,'B','p12','p14','K'),
  mkPA('g5',1,'B','p11','p14','BB'),
  mkPA('g5',1,'B','p6','p14','K'),
  // T2 — vs Sanchez
  mkPA('g5',2,'T','p13','p8','K'),
  mkPA('g5',2,'T','p14','p8','BB'),
  mkPA('g5',2,'T','p16','p8','BB'),
  mkPA('g5',2,'T','p17','p8','K'),
  mkPA('g5',2,'T','p15','p8','GO'),
  // B2 — vs Luke
  mkPA('g5',2,'B','p8','p14','BB'),
  mkPA('g5',2,'B','p12','p14','K'),
  mkPA('g5',2,'B','p11','p14','2B',1,0,'RBI; Sanchez scored'),
  mkPA('g5',2,'B','p6','p14','BB'),
  mkPA('g5',2,'B','p8','p14','K'),
  mkPA('g5',2,'B','p12','p14','K'),
  // T3 — vs Sanchez (then Kimmel comes in after Ulrich 3B)
  mkPA('g5',3,'T','p13','p8','BB'),
  mkPA('g5',3,'T','p14','p8','BB'),
  mkPA('g5',3,'T','p16','p8','3B',2,0,'2 RBI; L.Rose & Luke score'),
  // Kimmel (p6) comes in to pitch for Diamonds
  mkPA('g5',3,'T','p17','p6','BB'),
  mkPA('g5',3,'T','p15','p6','FC',1,0,'RBI FC; Ulrich scores'),
  mkPA('g5',3,'T','p13','p6','BB'),
  mkPA('g5',3,'T','p14','p6','FO',0,0,'pop out'),
  mkPA('g5',3,'T','p16','p6','K'),
  // B3 — vs Luke, then Logan relieves
  mkPA('g5',3,'B','p11','p14','1B'),
  mkPA('g5',3,'B','p6','p14','1B'),
  mkPA('g5',3,'B','p8','p14','1B',1,0,'RBI; Jankowski scored'),
  // Logan Rose (p13) comes in
  mkPA('g5',3,'B','p12','p13','BB'),
  mkPA('g5',3,'B','p11','p13','K'),
  mkPA('g5',3,'B','p6','p13','K'),
  mkPA('g5',3,'B','p8','p13','BB',1,0,'bases-loaded BB; Kimmel scores'),
  mkPA('g5',3,'B','p12','p13','BB',1,0,'walk-off bases-loaded BB; Sanchez scores'),

  // ============================================================
  // GAME 6 (2026-05-10): Diamonds @ Wolves, Diamonds win 5-0
  // Pitchers: Diamonds = Kimmel (p6) CG SHO; Wolves = J.Dalbey (p15) starts, Luke (p14) relieves T3
  // ============================================================
  // T1 — vs Dalbey
  mkPA('g6',1,'T','p6','p15','K'),
  mkPA('g6',1,'T','p8','p15','1B'),
  mkPA('g6',1,'T','p12','p15','1B'),
  mkPA('g6',1,'T','p11','p15','K'),
  mkPA('g6',1,'T','p6','p15','K'),
  // B1 — vs Kimmel
  mkPA('g6',1,'B','p15','p6','1B'),
  mkPA('g6',1,'B','p13','p6','K'),
  mkPA('g6',1,'B','p14','p6','K'),
  mkPA('g6',1,'B','p16','p6','FO',0,0,'fly out'),
  // T2 — vs Dalbey
  mkPA('g6',2,'T','p8','p15','K'),
  mkPA('g6',2,'T','p12','p15','BB'),
  mkPA('g6',2,'T','p11','p15','K'),
  mkPA('g6',2,'T','p6','p15','BB'),
  mkPA('g6',2,'T','p8','p15','BB'),
  mkPA('g6',2,'T','p12','p15','BB',1,0,'bases-loaded BB; RBI'),
  mkPA('g6',2,'T','p11','p15','K'),
  // B2 — vs Kimmel
  mkPA('g6',2,'B','p15','p6','BB'),
  mkPA('g6',2,'B','p13','p6','1B'),
  mkPA('g6',2,'B','p14','p6','FO',0,0,'pop out — double play'),
  mkPA('g6',2,'B','p16','p6','K'),
  // T3 — vs Dalbey, then Luke
  mkPA('g6',3,'T','p6','p15','HR',1,1,'solo HR'),
  mkPA('g6',3,'T','p8','p15','1B'),
  mkPA('g6',3,'T','p12','p15','BB'),
  // Luke (p14) comes in to pitch
  mkPA('g6',3,'T','p11','p14','HR',3,1,'3-run HR — Sanchez & Isaackson score'),
  mkPA('g6',3,'T','p6','p14','K'),
  mkPA('g6',3,'T','p8','p14','K'),
  mkPA('g6',3,'T','p12','p14','GO'),
  // B3 — vs Kimmel
  mkPA('g6',3,'B','p15','p6','K'),
  mkPA('g6',3,'B','p13','p6','BB'),
  mkPA('g6',3,'B','p14','p6','K'),
  mkPA('g6',3,'B','p16','p6','1B'),
  mkPA('g6',3,'B','p15','p6','BB'),
  mkPA('g6',3,'B','p13','p6','K'),
];

let _pitId = 0;
const mkPit = (gameId, pitcherId, gs, ip, r, er, h, bb, k, hr, cg, w, l, s, notes = '') => ({
  id: `pit${++_pitId}`, gameId, pitcherId, gs, ip, r, er, h, bb, k, hr, cg, w, l, s, notes,
});

export const DEFAULT_PITCHING = [
  // Game 1
  mkPit('g1','p6',1,4.0,0,0,2,3, 9,0,1,1,0,0,'CG win'),
  mkPit('g1','p2',1,4.0,1,0,2,2,11,0,1,0,1,0,'CG loss'),
  // Game 2
  mkPit('g2','p1',1,3.0,2,2,3,1, 6,1,1,0,1,0,'CG loss'),
  mkPit('g2','p7',1,2.0,1,1,4,0, 3,0,0,1,0,0,'starter; W'),
  mkPit('g2','p6',0,1.0,0,0,1,1, 2,0,0,0,0,1,'relief; save'),
  // Game 3
  mkPit('g3','p8',1,1.2,1,1,2,3, 1,0,0,0,0,0,'pulled in T2'),
  mkPit('g3','p6',0,2.1,4,3,4,2,10,0,0,0,1,0,'relief loss'),
  mkPit('g3','p2',1,4.0,1,1,3,1,11,1,1,1,0,0,'CG win'),

  // Game 4 — Diamonds @ Wolves, Wolves 6-0
  mkPit('g4','p14',1, 3.0, 0, 0, 1, 2, 8, 0, 1, 1, 0, 0, 'Luke Rose CG SHO'),
  mkPit('g4','p6', 1, 2.0, 6, 6, 7, 1, 6, 1, 1, 0, 1, 0, 'Kimmel CG loss'),

  // Game 5 — Wolves @ Diamonds, Diamonds 4-3 walk-off
  mkPit('g5','p8', 1, 2.2, 3, 3, 0, 6, 5, 0, 0, 0, 0, 0, 'Sanchez ND; pulled in T3'),
  mkPit('g5','p6', 0, 0.1, 0, 0, 0, 2, 1, 0, 0, 1, 0, 0, 'Kimmel relief W (walk-off)'),
  mkPit('g5','p14',1, 2.2, 2, 2, 5, 1, 3, 0, 0, 0, 0, 0, 'Luke starter ND; pulled in B3'),
  mkPit('g5','p13',0, 0.1, 2, 2, 0, 3, 2, 0, 0, 0, 1, 0, 'Logan relief loss; walk-off BB'),

  // Game 6 — Diamonds @ Wolves, Diamonds win
  mkPit('g6','p15',1, 2.0, 4, 4, 4, 5, 6, 1, 0, 0, 1, 0, 'Dalbey starter L; pulled T3 after Kimmel HR'),
  mkPit('g6','p14',0, 1.0, 1, 1, 1, 0, 2, 1, 0, 0, 0, 0, 'Luke relief'),
  mkPit('g6','p6', 1, 3.0, 0, 0, 3, 3, 6, 0, 1, 1, 0, 0, 'Kimmel CG SHO'),
];

// ============================================================
// CALCULATIONS
// ============================================================

export function ipToOuts(ip) {
  const whole = Math.floor(ip);
  const frac = Math.round((ip - whole) * 10);
  return whole * 3 + frac;
}

export function outsToIp(outs) {
  const whole = Math.floor(outs / 3);
  const frac = outs % 3;
  return whole + frac / 10;
}

export function calcBatting(playerPAs) {
  const counts = {};
  RESULT_CODES.forEach(c => counts[c.code] = 0);
  let pa = 0, rbi = 0, runs = 0;
  for (const p of playerPAs) {
    counts[p.result] = (counts[p.result] || 0) + 1;
    pa++;
    rbi += Number(p.rbi || 0);
    runs += Number(p.runs || 0);
  }
  const ab = ['K','1B','2B','3B','HR','GO','FO','FC','ROE'].reduce((s,c) => s + (counts[c]||0), 0);
  const hits = ['1B','2B','3B','HR'].reduce((s,c) => s + (counts[c]||0), 0);
  const tb = (counts['1B']||0) + 2*(counts['2B']||0) + 3*(counts['3B']||0) + 4*(counts['HR']||0);
  const bb = counts['BB'] || 0;
  const k = counts['K'] || 0;
  const hr = counts['HR'] || 0;
  const xbh = (counts['2B']||0) + (counts['3B']||0) + (counts['HR']||0);
  const avg = ab > 0 ? hits / ab : 0;
  const obp = (ab + bb) > 0 ? (hits + bb) / (ab + bb) : 0;
  const slg = ab > 0 ? tb / ab : 0;
  const ops = obp + slg;
  const iso = slg - avg;
  const babip = (ab - k - hr) > 0 ? (hits - hr) / (ab - k - hr) : 0;
  const kpct = pa > 0 ? k / pa * 100 : 0;
  const bbpct = pa > 0 ? bb / pa * 100 : 0;
  return {
    pa, ab, hits, runs, rbi, bb, k, hr,
    ones: counts['1B']||0, twos: counts['2B']||0, threes: counts['3B']||0,
    xbh, tb, avg, obp, slg, ops, iso, babip, kpct, bbpct,
    fc: counts['FC']||0, roe: counts['ROE']||0, hbp: counts['HBP']||0,
  };
}

export function calcPitching(rows) {
  let outs = 0, r = 0, er = 0, h = 0, bb = 0, k = 0, hr = 0;
  let cg = 0, w = 0, l = 0, s = 0, gs = 0, gp = 0;
  for (const p of rows) {
    outs += ipToOuts(Number(p.ip||0));
    r += Number(p.r||0); er += Number(p.er||0); h += Number(p.h||0);
    bb += Number(p.bb||0); k += Number(p.k||0); hr += Number(p.hr||0);
    cg += Number(p.cg||0); w += Number(p.w||0); l += Number(p.l||0); s += Number(p.s||0);
    gs += Number(p.gs||0); gp++;
  }
  const ipDecimal = outs / 3;
  const era = ipDecimal > 0 ? 3 * er / ipDecimal : 0;
  const whip = ipDecimal > 0 ? (bb + h) / ipDecimal : 0;
  const k3 = ipDecimal > 0 ? k / ipDecimal : 0;
  const bb3 = ipDecimal > 0 ? bb / ipDecimal : 0;
  const hr3 = ipDecimal > 0 ? hr / ipDecimal : 0;
  const bf = 3 * ipDecimal + h + bb;
  const kpct = bf > 0 ? k / bf * 100 : 0;
  const bbpct = bf > 0 ? bb / bf * 100 : 0;
  const oba = (3 * ipDecimal + h) > 0 ? h / (3 * ipDecimal + h) : 0;
  return { gp, gs, ip: outsToIp(outs), ipDecimal, r, er, h, bb, k, hr, cg, w, l, s, era, whip, k3, bb3, hr3, kpct, bbpct, oba };
}

// ============================================================
// FORMATTERS
// ============================================================

export const fmtAvg = (n) => Number.isFinite(n) ? n.toFixed(3).replace(/^0\./, '.').replace(/^-0\./, '-.') : '—';
export const fmtRate = (n) => Number.isFinite(n) ? n.toFixed(2) : '—';
export const fmtIp = (n) => Number.isFinite(n) ? n.toFixed(1) : '—';
export const fmtEra = (n) => Number.isFinite(n) ? n.toFixed(2) : '—';

export function formatDate(iso) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}
