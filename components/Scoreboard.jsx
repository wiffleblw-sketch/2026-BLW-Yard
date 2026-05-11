'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RESULT_CODES, TEAM_PRESETS,
  SEASON_LABEL, LEAGUE_TITLE, LEAGUE_SUB,
  calcBatting, calcPitching, ipToOuts, outsToIp,
  fmtAvg, fmtRate, fmtIp, fmtEra, formatDate,
} from '../lib/data';
import { LOGO_DATA_URL, TEAM_LOGOS } from '../lib/logos';

// fmtPct helper (was inline in the artifact)
const fmtPct = (n) => Number.isFinite(n) ? n.toFixed(1) : '—';

// ============================================================
// API CLIENT — talks to /api/data and /api/auth
// ============================================================

async function saveDataToApi(payload) {
  const res = await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Save failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function loadDataFromApi() {
  const res = await fetch('/api/data', { cache: 'no-store' });
  if (!res.ok) throw new Error('Load failed');
  return res.json();
}

async function attemptLogin(password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

async function logout() {
  await fetch('/api/auth', { method: 'DELETE' });
}

// ============================================================
// HELPER COMPONENT
// ============================================================

// TeamLogo: renders the team's image if logoKey is set, otherwise letter circle
function TeamLogo({ team, size = 36, className = '' }) {
  const logo = team?.logoKey && TEAM_LOGOS[team.logoKey];
  if (logo) {
    return (
      <span className={`team-logo-img-wrap ${className}`} style={{width: size, height: size}}>
        <img src={logo} alt={team.abbr} className="team-logo-img"/>
      </span>
    );
  }
  return (
    <span className={`team-logo-fallback ${className}`} style={{width: size, height: size, background: team?.primary}}>
      <span className="team-logo-fallback-letter">{team?.abbr?.charAt(0) || '?'}</span>
    </span>
  );
}

// ============================================================
// MAIN APP — entry point exported for Next.js page
// ============================================================

// ============================================================
// MAIN APP
// ============================================================

export default function Scoreboard({ initialData, initialCanEdit }) {
  const [view, setView] = useState('scores');
  const [selectedGameId, setSelectedGameId] = useState(null);

  const [teams, setTeams] = useState(initialData.teams);
  const [players, setPlayers] = useState(initialData.players);
  const [games, setGames] = useState(initialData.games);
  const [pas, setPAs] = useState(initialData.pas);
  const [pitching, setPitching] = useState(initialData.pitching);
  const [editMode, setEditMode] = useState(!!initialCanEdit);
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [saving, setSaving] = useState(false);



  // Save to server whenever data changes — but only if we're in edit mode
  // (otherwise we'd be re-saving the data we just loaded from the server with no changes).
  // We track whether the user has actually mutated anything via a dirty flag.
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);

  useEffect(() => {
    if (!dirty || !editMode) return;
    let cancelled = false;
    setSaving(true);
    saveDataToApi({ teams, players, games, pas, pitching })
      .then(() => {
        if (!cancelled) {
          setSaving(false);
          setDirty(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setSaving(false);
          alert('Save failed. Are you signed in to edit?');
        }
      });
    return () => { cancelled = true; };
  }, [dirty, editMode, teams, players, games, pas, pitching]);

  // Wrap setters so any change marks dirty
  const setTeamsM = useCallback((v) => { setTeams(v); markDirty(); }, [markDirty]);
  const setPlayersM = useCallback((v) => { setPlayers(v); markDirty(); }, [markDirty]);
  const setGamesM = useCallback((v) => { setGames(v); markDirty(); }, [markDirty]);
  const setPAsM = useCallback((v) => { setPAs(v); markDirty(); }, [markDirty]);
  const setPitchingM = useCallback((v) => { setPitching(v); markDirty(); }, [markDirty]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-mark">
          <img src={LOGO_DATA_URL} alt="BLW" className="loading-logo"/>
          <span>{LEAGUE_TITLE}</span>
        </div>
      </div>
    );
  }

  const getPlayer = (id) => players.find(p => p.id === id) || { name: '?', teamId: '?' };
  const getTeam = (id) => teams.find(t => t.id === id) || { name: '?', primary: '#888', abbr: '?' };

  const openGame = (id) => { setSelectedGameId(id); setView('game'); };

  const resetAll = async () => {
    if (!confirm('Reset everything to seed data? This affects EVERYONE viewing this site.')) return;
    try {
      const res = await fetch('/api/data?seed=1', { method: 'GET' });
      const fresh = await loadDataFromApi();
      setTeams(fresh.teams); setPlayers(fresh.players); setGames(fresh.games); setPAs(fresh.pas); setPitching(fresh.pitching);
    } catch (e) {
      alert('Reset failed: ' + e.message);
    }
  };

  const clearAll = async () => {
    if (!confirm('Clear ALL data? This affects EVERYONE viewing this site. Cannot be undone.')) return;
    setTeamsM([]); setPlayersM([]); setGamesM([]); setPAsM([]); setPitchingM([]);
  };

  return (
    <div className="app">
        <ScoreTicker games={games} teams={teams} players={players} pas={pas} openGame={openGame} />
        <Header
          view={view} setView={setView}
          setSelectedGameId={setSelectedGameId}
          editMode={editMode}
          onRequestEdit={() => setShowLogin(true)}
          onLogout={async () => {
            await logout();
            setEditMode(false);
            if (view === 'manage') setView('scores');
          }}
          saving={saving}
        />
        <main className="main">
          {view === 'scores' && (
            <ScoresView
              teams={teams} players={players} games={games} pas={pas}
              openGame={openGame}
            />
          )}
          {view === 'batting' && (
            <BattingView teams={teams} players={players} games={games} pas={pas} />
          )}
          {view === 'pitching' && (
            <PitchingView teams={teams} players={players} pitching={pitching} />
          )}
          {view === 'standings' && (
            <StandingsView teams={teams} players={players} games={games} pas={pas} />
          )}
          {view === 'game' && (
            <GameView
              gameId={selectedGameId}
              teams={teams} players={players} games={games} pas={pas} pitching={pitching}
              back={() => setView('scores')}
              getPlayer={getPlayer} getTeam={getTeam}
            />
          )}
          {view === 'manage' && editMode && (
            <ManageView
              teams={teams} setTeams={setTeamsM}
              players={players} setPlayers={setPlayersM}
              games={games} setGames={setGamesM}
              pas={pas} setPAs={setPAsM}
              pitching={pitching} setPitching={setPitchingM}
              openGame={openGame}
              resetAll={resetAll} clearAll={clearAll}
            />
          )}
          {view === 'manage' && !editMode && (
            <div className="empty-state-big">
              <div className="empty-icon">🔒</div>
              <h2>VIEW MODE</h2>
              <p>Toggle Edit Mode in the header to add games, players, and stats.</p>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <img src={LOGO_DATA_URL} alt="BLW" className="footer-logo-img"/>
              <span>{LEAGUE_TITLE}</span>
              <span className="footer-sep">·</span>
              <span>{SEASON_LABEL}</span>
            </div>
            <div className="footer-meta">
              {editMode ? 'EDIT MODE' : 'VIEW MODE'} · share this link to broadcast scores
            </div>
          </div>
        </footer>
        {showLogin && (
          <LoginModal
            onCancel={() => setShowLogin(false)}
            onSuccess={async () => {
              setShowLogin(false);
              setEditMode(true);
              // Reload data in case it was updated by another editor while we were away
              try {
                const fresh = await loadDataFromApi();
                setTeams(fresh.teams); setPlayers(fresh.players);
                setGames(fresh.games); setPAs(fresh.pas); setPitching(fresh.pitching);
              } catch (e) { console.warn(e); }
            }}
          />
        )}
      </div>
    );
  }

// ============================================================
// SCORE TICKER (top, ProWiffle-style)
// ============================================================

function ScoreTicker({ games, teams, players, pas, openGame }) {
  if (!games || games.length === 0) return null;
  return (
    <div className="ticker">
      <div className="ticker-inner">
        {games.slice(-12).map(g => {
          const away = teams.find(t => t.id === g.awayTeamId);
          const home = teams.find(t => t.id === g.homeTeamId);
          const awayR = pas.filter(p => p.gameId === g.id && players.find(pp => pp.id === p.batterId)?.teamId === g.awayTeamId).reduce((s,p) => s + Number(p.runs||0), 0);
          const homeR = pas.filter(p => p.gameId === g.id && players.find(pp => pp.id === p.batterId)?.teamId === g.homeTeamId).reduce((s,p) => s + Number(p.runs||0), 0);
          const awayWin = awayR > homeR;
          const homeWin = homeR > awayR;
          return (
            <button key={g.id} className="ticker-card" onClick={() => openGame(g.id)}>
              <div className="ticker-status">
                {g.status === 'final' ? 'FINAL' : g.status === 'partial' ? 'PART' : 'LIVE'}
              </div>
              <div className="ticker-rows">
                <div className={`ticker-row ${awayWin ? 'is-winner' : (homeWin ? 'is-loser' : '')}`}>
                  <TeamLogo team={away} size={20} className="ticker-team-logo"/>
                  <span className="ticker-team-abbr">{away?.abbr}</span>
                  <span className="ticker-score">{awayR}</span>
                </div>
                <div className={`ticker-row ${homeWin ? 'is-winner' : (awayWin ? 'is-loser' : '')}`}>
                  <TeamLogo team={home} size={20} className="ticker-team-logo"/>
                  <span className="ticker-team-abbr">{home?.abbr}</span>
                  <span className="ticker-score">{homeR}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// HEADER
// ============================================================

function Header({ view, setView, setSelectedGameId, editMode, onRequestEdit, onLogout, saving }) {
  const tab = (label, v) => (
    <button
      className={`nav-tab ${view === v ? 'is-active' : ''}`}
      onClick={() => { setView(v); if (v !== 'game') setSelectedGameId(null); }}
    >
      {label}
    </button>
  );
  return (
    <header className="header">
      <div className="header-top">
        <div className="header-top-inner">
          <div className="brand">
            <div className="brand-logo">
              <img src={LOGO_DATA_URL} alt="BLW" className="brand-logo-img"/>
            </div>
            <div className="brand-text">
              <div className="brand-name">{LEAGUE_TITLE}</div>
              <div className="brand-sub">{LEAGUE_SUB}</div>
            </div>
          </div>
          <div className="brand-season">
            <div className="brand-season-label">{SEASON_LABEL}</div>
          </div>
          <div className="header-tools">
            {saving && <span className="saving-pill">SAVING…</span>}
            <button
              className={`edit-toggle ${editMode ? 'is-on' : ''}`}
              onClick={editMode ? onLogout : onRequestEdit}
              title={editMode ? 'Click to sign out of edit mode' : 'Click to sign in for editing'}
            >
              <span className="edit-toggle-dot"/>
              <span>{editMode ? 'EDIT MODE' : 'VIEW ONLY'}</span>
            </button>
          </div>
        </div>
      </div>
      <nav className="header-nav">
        <div className="header-nav-inner">
          {tab('Scores', 'scores')}
          {tab('Batting', 'batting')}
          {tab('Pitching', 'pitching')}
          {tab('Standings', 'standings')}
          {editMode && tab('Manage', 'manage')}
        </div>
      </nav>
    </header>
  );
}

// ============================================================
// SCORES VIEW (game cards)
// ============================================================

function ScoresView({ teams, players, games, pas, openGame }) {
  if (games.length === 0) {
    return (
      <div className="empty-state-big">
        <h2>NO GAMES YET</h2>
        <p>Enable Edit Mode and add your first game to get started.</p>
      </div>
    );
  }

  // Group games by date
  const gamesByDate = {};
  games.forEach(g => {
    if (!gamesByDate[g.date]) gamesByDate[g.date] = [];
    gamesByDate[g.date].push(g);
  });

  const dates = Object.keys(gamesByDate).sort().reverse();

  return (
    <div className="scores-view">
      <PageHeader eyebrow={SEASON_LABEL} title="Scoreboard" subtitle="all games · click any matchup for full box score" />

      {dates.map(date => (
        <div key={date} className="date-block">
          <div className="date-header">
            <span className="date-label">{formatDate(date)}</span>
            <span className="date-count">{gamesByDate[date].length} game{gamesByDate[date].length === 1 ? '' : 's'}</span>
          </div>
          <div className="game-grid">
            {gamesByDate[date].map(g => (
              <GameCard key={g.id} game={g} teams={teams} players={players} pas={pas} onClick={() => openGame(g.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GameCard({ game, teams, players, pas, onClick }) {
  const away = teams.find(t => t.id === game.awayTeamId);
  const home = teams.find(t => t.id === game.homeTeamId);
  const awayR = pas.filter(p => p.gameId === game.id && players.find(pp => pp.id === p.batterId)?.teamId === game.awayTeamId).reduce((s,p) => s + Number(p.runs||0), 0);
  const homeR = pas.filter(p => p.gameId === game.id && players.find(pp => pp.id === p.batterId)?.teamId === game.homeTeamId).reduce((s,p) => s + Number(p.runs||0), 0);
  const awayWin = awayR > homeR;
  const homeWin = homeR > awayR;

  return (
    <button className="game-card" onClick={onClick}>
      <div className="gc-header">
        <span className={`gc-status status-${game.status}`}>
          {game.status === 'final' ? 'FINAL' : game.status === 'partial' ? 'PARTIAL' : 'LIVE'}
        </span>
        <span className="gc-cta">BOX SCORE →</span>
      </div>

      <div className="gc-body">
        <div className={`gc-team-line ${awayWin ? 'is-winner' : (homeWin ? 'is-loser' : '')}`}>
          <TeamLogo team={away} size={42} className="gc-team-logo"/>
          <div className="gc-team-info">
            <div className="gc-team-name">{away?.name}</div>
            <div className="gc-team-tag">AWAY</div>
          </div>
          <div className="gc-team-score">{awayR}</div>
        </div>

        <div className={`gc-team-line ${homeWin ? 'is-winner' : (awayWin ? 'is-loser' : '')}`}>
          <TeamLogo team={home} size={42} className="gc-team-logo"/>
          <div className="gc-team-info">
            <div className="gc-team-name">{home?.name}</div>
            <div className="gc-team-tag">HOME</div>
          </div>
          <div className="gc-team-score">{homeR}</div>
        </div>
      </div>

      {game.notes && <div className="gc-note">{game.notes}</div>}
    </button>
  );
}

// ============================================================
// PAGE HEADER
// ============================================================

function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="page-header">
      {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
      <h1 className="page-title">{title}</h1>
      {subtitle && <div className="page-sub">{subtitle}</div>}
    </div>
  );
}

// ============================================================
// LEADER STAT TILE (ProWiffle-style)
// ============================================================

function LeaderTile({ label, value, player, team }) {
  if (!player) return null;
  return (
    <div className="leader-tile">
      <div className="leader-label">{label}</div>
      <div className="leader-body">
        <div className="leader-avatar" style={{background: team?.primary}}>
          <span className="leader-avatar-letter">{player.name.charAt(0)}</span>
        </div>
        <div className="leader-meta">
          <div className="leader-name">{player.name}</div>
          <div className="leader-value">{value}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BATTING VIEW
// ============================================================

function BattingView({ teams, players, games, pas }) {
  const [teamFilter, setTeamFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('ops');
  const [sortDir, setSortDir] = useState('desc');

  const allRows = useMemo(() => {
    return players.map(pl => {
      const pl_pas = pas.filter(p => p.batterId === pl.id);
      const stats = calcBatting(pl_pas);
      const team = teams.find(t => t.id === pl.teamId);
      const gp = new Set(pl_pas.map(p => p.gameId)).size;
      return { player: pl, team, gp, ...stats };
    }).filter(r => r.pa > 0);
  }, [players, pas, teams]);

  const leaders = useMemo(() => ({
    avg: [...allRows].sort((a,b) => b.avg - a.avg)[0],
    hits: [...allRows].sort((a,b) => b.hits - a.hits)[0],
    hr: [...allRows].sort((a,b) => b.hr - a.hr)[0],
    rbi: [...allRows].sort((a,b) => b.rbi - a.rbi)[0],
  }), [allRows]);

  const filteredRows = allRows
    .filter(r => teamFilter === 'all' || r.team?.id === teamFilter)
    .filter(r => !search || r.player.name.toLowerCase().includes(search.toLowerCase()));

  const sortedRows = useMemo(() => {
    const out = [...filteredRows];
    out.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      const cmp = (av === bv) ? 0 : (av > bv ? 1 : -1);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return out;
  }, [filteredRows, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const cols = [
    { k: 'gp', label: 'G' },
    { k: 'pa', label: 'PA' },
    { k: 'ab', label: 'AB' },
    { k: 'hits', label: 'H' },
    { k: 'ones', label: '1B' },
    { k: 'twos', label: '2B' },
    { k: 'threes', label: '3B' },
    { k: 'hr', label: 'HR' },
    { k: 'tb', label: 'TB' },
    { k: 'runs', label: 'R' },
    { k: 'rbi', label: 'RBI' },
    { k: 'bb', label: 'BB' },
    { k: 'k', label: 'K' },
    { k: 'avg', label: 'AVG', fmt: fmtAvg },
    { k: 'obp', label: 'OBP', fmt: fmtAvg },
    { k: 'slg', label: 'SLG', fmt: fmtAvg },
    { k: 'ops', label: 'OPS', fmt: fmtAvg },
    { k: 'iso', label: 'ISO', fmt: fmtAvg },
    { k: 'babip', label: 'BABIP', fmt: fmtAvg },
  ];

  return (
    <div className="stats-page">
      <PageHeader eyebrow={SEASON_LABEL} title="Batting Statistics" />

      <div className="leaders-row">
        {leaders.avg && <LeaderTile label="BATTING AVERAGE" value={fmtAvg(leaders.avg.avg)} player={leaders.avg.player} team={leaders.avg.team} />}
        {leaders.hits && <LeaderTile label="HITS" value={leaders.hits.hits} player={leaders.hits.player} team={leaders.hits.team} />}
        {leaders.hr && leaders.hr.hr > 0 && <LeaderTile label="HOME RUNS" value={leaders.hr.hr} player={leaders.hr.player} team={leaders.hr.team} />}
        {leaders.rbi && <LeaderTile label="RUNS BATTED IN" value={leaders.rbi.rbi} player={leaders.rbi.player} team={leaders.rbi.team} />}
      </div>

      <div className="table-controls">
        <div className="control-group">
          <select className="select" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="control-group control-group-grow">
          <input
            className="search-input"
            type="text"
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <StatsTable cols={cols} rows={sortedRows} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
    </div>
  );
}

// ============================================================
// PITCHING VIEW
// ============================================================

function PitchingView({ teams, players, pitching }) {
  const [teamFilter, setTeamFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('era');
  const [sortDir, setSortDir] = useState('asc');

  const allRows = useMemo(() => {
    const pitcherIds = [...new Set(pitching.map(p => p.pitcherId))];
    return pitcherIds.map(pid => {
      const rows = pitching.filter(p => p.pitcherId === pid);
      const stats = calcPitching(rows);
      const player = players.find(p => p.id === pid);
      if (!player) return null;
      const team = teams.find(t => t.id === player.teamId);
      return { player, team, ...stats };
    }).filter(Boolean);
  }, [pitching, players, teams]);

  const leaders = useMemo(() => {
    const withIp = allRows.filter(r => r.ipDecimal > 0);
    return {
      era: [...withIp].sort((a,b) => a.era - b.era)[0],
      k: [...allRows].sort((a,b) => b.k - a.k)[0],
      whip: [...withIp].sort((a,b) => a.whip - b.whip)[0],
      w: [...allRows].sort((a,b) => b.w - a.w)[0],
    };
  }, [allRows]);

  const filteredRows = allRows
    .filter(r => teamFilter === 'all' || r.team?.id === teamFilter)
    .filter(r => !search || r.player.name.toLowerCase().includes(search.toLowerCase()));

  const sortedRows = useMemo(() => {
    const out = [...filteredRows];
    out.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      const cmp = (av === bv) ? 0 : (av > bv ? 1 : -1);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return out;
  }, [filteredRows, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const cols = [
    { k: 'gp', label: 'G' },
    { k: 'gs', label: 'GS' },
    { k: 'ip', label: 'IP', fmt: fmtIp },
    { k: 'w', label: 'W' },
    { k: 'l', label: 'L' },
    { k: 's', label: 'SV' },
    { k: 'cg', label: 'CG' },
    { k: 'h', label: 'H' },
    { k: 'r', label: 'R' },
    { k: 'er', label: 'ER' },
    { k: 'hr', label: 'HR' },
    { k: 'bb', label: 'BB' },
    { k: 'k', label: 'K' },
    { k: 'era', label: 'ERA', fmt: fmtEra },
    { k: 'whip', label: 'WHIP', fmt: fmtRate },
    { k: 'k3', label: 'K/3', fmt: fmtRate },
    { k: 'bb3', label: 'BB/3', fmt: fmtRate },
    { k: 'oba', label: 'OBA', fmt: fmtAvg },
  ];

  return (
    <div className="stats-page">
      <PageHeader eyebrow={SEASON_LABEL} title="Pitching Statistics" />

      <div className="leaders-row">
        {leaders.era && <LeaderTile label="ERA" value={fmtEra(leaders.era.era)} player={leaders.era.player} team={leaders.era.team} />}
        {leaders.k && <LeaderTile label="STRIKEOUTS" value={leaders.k.k} player={leaders.k.player} team={leaders.k.team} />}
        {leaders.whip && <LeaderTile label="WHIP" value={fmtRate(leaders.whip.whip)} player={leaders.whip.player} team={leaders.whip.team} />}
        {leaders.w && leaders.w.w > 0 && <LeaderTile label="WINS" value={leaders.w.w} player={leaders.w.player} team={leaders.w.team} />}
      </div>

      <div className="table-controls">
        <div className="control-group">
          <select className="select" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="control-group control-group-grow">
          <input
            className="search-input"
            type="text"
            placeholder="Search pitchers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <StatsTable cols={cols} rows={sortedRows} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
    </div>
  );
}

// ============================================================
// STATS TABLE (shared for batting & pitching)
// ============================================================

function StatsTable({ cols, rows, sortBy, sortDir, onSort }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="th-rank">#</th>
            <th className="th-player">PLAYER</th>
            <th className="th-team">TEAM</th>
            {cols.map(c => (
              <th
                key={c.k}
                className={`sortable ${sortBy === c.k ? 'is-sorted' : ''}`}
                onClick={() => onSort(c.k)}
              >
                <span>{c.label}</span>
                <span className={`sort-arrow ${sortBy === c.k ? 'is-on' : ''}`}>
                  {sortBy === c.k ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.player.id}>
              <td className="td-rank">{idx + 1}</td>
              <td className="td-player">
                <span className="td-avatar" style={{background: r.team?.primary}}>
                  <span className="td-avatar-letter">{r.player.name.charAt(0)}</span>
                </span>
                <span className="td-player-name">{r.player.name}</span>
              </td>
              <td className="td-team">
                <span className="team-badge" style={{background: r.team?.primary}}>{r.team?.abbr}</span>
              </td>
              {cols.map(c => (
                <td key={c.k} className={sortBy === c.k ? 'cell-sorted' : ''}>
                  {c.fmt ? c.fmt(r[c.k]) : r[c.k]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length + 3} className="empty-row">No players match the current filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// STANDINGS VIEW
// ============================================================

function StandingsView({ teams, players, games, pas }) {
  const standings = useMemo(() => {
    const map = {};
    teams.forEach(t => { map[t.id] = { team: t, w: 0, l: 0, t: 0, rs: 0, ra: 0 }; });

    games.forEach(g => {
      if (g.status !== 'final') return;
      const awayR = pas.filter(p => p.gameId === g.id && players.find(pp => pp.id === p.batterId)?.teamId === g.awayTeamId).reduce((s,p) => s + Number(p.runs||0), 0);
      const homeR = pas.filter(p => p.gameId === g.id && players.find(pp => pp.id === p.batterId)?.teamId === g.homeTeamId).reduce((s,p) => s + Number(p.runs||0), 0);
      if (map[g.awayTeamId]) {
        map[g.awayTeamId].rs += awayR;
        map[g.awayTeamId].ra += homeR;
        if (awayR > homeR) map[g.awayTeamId].w++;
        else if (awayR < homeR) map[g.awayTeamId].l++;
        else map[g.awayTeamId].t++;
      }
      if (map[g.homeTeamId]) {
        map[g.homeTeamId].rs += homeR;
        map[g.homeTeamId].ra += awayR;
        if (homeR > awayR) map[g.homeTeamId].w++;
        else if (homeR < awayR) map[g.homeTeamId].l++;
        else map[g.homeTeamId].t++;
      }
    });

    return Object.values(map)
      .map(s => ({ ...s, gp: s.w + s.l + s.t, pct: (s.w + s.l) > 0 ? s.w / (s.w + s.l) : 0, diff: s.rs - s.ra }))
      .sort((a, b) => b.pct - a.pct || b.diff - a.diff);
  }, [teams, players, games, pas]);

  return (
    <div className="stats-page">
      <PageHeader eyebrow={SEASON_LABEL} title="Standings" subtitle="based on completed games" />

      <div className="data-table-wrap">
        <table className="data-table standings-table">
          <thead>
            <tr>
              <th className="th-rank">#</th>
              <th className="th-player">TEAM</th>
              <th>GP</th>
              <th>W</th>
              <th>L</th>
              <th>T</th>
              <th>PCT</th>
              <th>RS</th>
              <th>RA</th>
              <th>DIFF</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, idx) => (
              <tr key={s.team.id}>
                <td className="td-rank">{idx + 1}</td>
                <td className="td-player">
                  <TeamLogo team={s.team} size={28} className="td-team-logo"/>
                  <span className="td-player-name">{s.team.name}</span>
                </td>
                <td>{s.gp}</td>
                <td className="cell-bold">{s.w}</td>
                <td>{s.l}</td>
                <td>{s.t}</td>
                <td className="cell-bold">{fmtAvg(s.pct)}</td>
                <td>{s.rs}</td>
                <td>{s.ra}</td>
                <td className={s.diff > 0 ? 'cell-pos' : (s.diff < 0 ? 'cell-neg' : '')}>
                  {s.diff > 0 ? '+' : ''}{s.diff}
                </td>
              </tr>
            ))}
            {standings.length === 0 && <tr><td colSpan={10} className="empty-row">No teams yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// GAME VIEW (box score)
// ============================================================

function GameView({ gameId, teams, players, games, pas, pitching, back, getPlayer, getTeam }) {
  const game = games.find(g => g.id === gameId);
  if (!game) return <div className="empty-state-big"><p>Game not found.</p><button className="btn" onClick={back}>Back</button></div>;

  const away = getTeam(game.awayTeamId);
  const home = getTeam(game.homeTeamId);
  const gamePAs = pas.filter(p => p.gameId === gameId);
  const gamePitching = pitching.filter(p => p.gameId === gameId);

  const innings = Array.from({length: game.innings}, (_, i) => i + 1);
  const linescore = innings.map(inn => {
    const topR = gamePAs.filter(p => p.inning === inn && p.half === 'T').reduce((s,p) => s + Number(p.runs||0), 0);
    const botR = gamePAs.filter(p => p.inning === inn && p.half === 'B').reduce((s,p) => s + Number(p.runs||0), 0);
    return { inn, topR, botR };
  });
  const awayTotal = linescore.reduce((s,l) => s + l.topR, 0);
  const homeTotal = linescore.reduce((s,l) => s + l.botR, 0);
  const awayHits = gamePAs.filter(p => players.find(pp => pp.id === p.batterId)?.teamId === away.id && ['1B','2B','3B','HR'].includes(p.result)).length;
  const homeHits = gamePAs.filter(p => players.find(pp => pp.id === p.batterId)?.teamId === home.id && ['1B','2B','3B','HR'].includes(p.result)).length;

  const awayWin = awayTotal > homeTotal;
  const homeWin = homeTotal > awayTotal;

  const battingBox = (teamId) => {
    return players.filter(pl => pl.teamId === teamId).map(pl => {
      const plPAs = gamePAs.filter(p => p.batterId === pl.id);
      if (plPAs.length === 0) return null;
      const stats = calcBatting(plPAs);
      return { player: pl, ...stats };
    }).filter(Boolean);
  };

  const awayBatting = battingBox(away.id);
  const homeBatting = battingBox(home.id);

  const pitchingBox = (teamId) => {
    return gamePitching
      .filter(p => players.find(pp => pp.id === p.pitcherId)?.teamId === teamId)
      .map(p => ({...p, player: getPlayer(p.pitcherId)}));
  };

  const awayPitching = pitchingBox(away.id);
  const homePitching = pitchingBox(home.id);

  const playsByInning = {};
  innings.forEach(inn => { playsByInning[inn] = { T: [], B: [] }; });
  gamePAs.forEach(p => { if (playsByInning[p.inning]) playsByInning[p.inning][p.half].push(p); });

  return (
    <div className="game-view">
      <button className="back-btn" onClick={back}>← All Scores</button>

      {/* HERO */}
      <div className="game-hero">
        <div className="game-hero-status">
          <span className={`hero-status-pill status-${game.status}`}>
            {game.status === 'final' ? 'FINAL' : game.status.toUpperCase()}
          </span>
          <span className="hero-meta">{formatDate(game.date)}{game.innings > 3 ? ` · ${game.innings - 3} EXTRA INN` : ''}</span>
        </div>

        <div className="hero-matchup">
          <div className={`hero-team-block ${awayWin ? 'is-winner' : (homeWin ? 'is-loser' : '')}`}>
            <TeamLogo team={away} size={96} className="hero-team-logo"/>
            <div className="hero-team-meta">AWAY</div>
            <div className="hero-team-name">{away.name}</div>
            <div className="hero-score">{awayTotal}</div>
          </div>

          <div className="hero-vs">
            <div className="hero-vs-text">VS</div>
            {awayWin && <div className="hero-result">{away.abbr} WIN</div>}
            {homeWin && <div className="hero-result">{home.abbr} WIN</div>}
            {!awayWin && !homeWin && awayTotal === homeTotal && awayTotal > 0 && <div className="hero-result">TIED</div>}
          </div>

          <div className={`hero-team-block ${homeWin ? 'is-winner' : (awayWin ? 'is-loser' : '')}`}>
            <TeamLogo team={home} size={96} className="hero-team-logo"/>
            <div className="hero-team-meta">HOME</div>
            <div className="hero-team-name">{home.name}</div>
            <div className="hero-score">{homeTotal}</div>
          </div>
        </div>

        {/* LINESCORE */}
        <div className="linescore-wrap">
          <table className="linescore">
            <thead>
              <tr>
                <th></th>
                {innings.map(i => <th key={i} className={i > 3 ? 'ls-extra-col' : ''}>{i > 3 ? `${i}*` : i}</th>)}
                <th className="ls-rhe">R</th>
                <th className="ls-rhe">H</th>
              </tr>
            </thead>
            <tbody>
              <tr className={awayWin ? 'is-winner' : ''}>
                <td className="ls-team">
                  <span className="ls-color" style={{background: away.primary}}/>
                  <span>{away.abbr}</span>
                </td>
                {linescore.map(l => <td key={l.inn} className="ls-cell">{l.topR}</td>)}
                <td className="ls-rhe">{awayTotal}</td>
                <td className="ls-rhe">{awayHits}</td>
              </tr>
              <tr className={homeWin ? 'is-winner' : ''}>
                <td className="ls-team">
                  <span className="ls-color" style={{background: home.primary}}/>
                  <span>{home.abbr}</span>
                </td>
                {linescore.map(l => <td key={l.inn} className="ls-cell">{l.botR}</td>)}
                <td className="ls-rhe">{homeTotal}</td>
                <td className="ls-rhe">{homeHits}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {game.innings > 3 && <div className="ls-foot">* extra innings</div>}

        {game.notes && <div className="hero-note">{game.notes}</div>}
      </div>

      {/* BOX SCORES */}
      <div className="game-section">
        <SectionHeader title="Batting" />
        <div className="box-pair">
          <BoxScoreBatting team={away} rows={awayBatting} />
          <BoxScoreBatting team={home} rows={homeBatting} />
        </div>
      </div>

      <div className="game-section">
        <SectionHeader title="Pitching" />
        <div className="box-pair">
          <BoxScorePitching team={away} rows={awayPitching} />
          <BoxScorePitching team={home} rows={homePitching} />
        </div>
      </div>

      <div className="game-section">
        <SectionHeader title="Play-by-Play" subtitle="every plate appearance, in order" />
        <div className="pbp-wrap">
          {innings.map(inn => (
            <div key={inn} className="pbp-inning">
              <div className="pbp-inning-header">INNING {inn}</div>
              <div className="pbp-half-grid">
                <div className="pbp-half">
                  <div className="pbp-half-header">
                    <span>▲</span><span>TOP</span>
                    <span className="pbp-half-team" style={{color: away.primary}}>{away.abbr}</span>
                  </div>
                  <ol className="pbp-list">
                    {playsByInning[inn].T.length === 0 && <li className="pbp-empty">— no plays —</li>}
                    {playsByInning[inn].T.map(p => (
                      <PlayItem key={p.id} play={p} player={getPlayer(p.batterId)} />
                    ))}
                  </ol>
                </div>
                <div className="pbp-half">
                  <div className="pbp-half-header">
                    <span>▼</span><span>BOT</span>
                    <span className="pbp-half-team" style={{color: home.primary}}>{home.abbr}</span>
                  </div>
                  <ol className="pbp-list">
                    {playsByInning[inn].B.length === 0 && <li className="pbp-empty">— no plays —</li>}
                    {playsByInning[inn].B.map(p => (
                      <PlayItem key={p.id} play={p} player={getPlayer(p.batterId)} />
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="section-header">
      <h2 className="section-h2">{title}</h2>
      {subtitle && <div className="section-sub">{subtitle}</div>}
    </div>
  );
}

function PlayItem({ play, player }) {
  const isHit = ['1B','2B','3B','HR'].includes(play.result);
  const isHR = play.result === 'HR';
  const isWalk = play.result === 'BB';
  const isOut = ['K','GO','FO','FC'].includes(play.result);
  return (
    <li className="play-item">
      <span className="play-batter">{player.name}</span>
      <span className={`play-result ${isHit ? 'is-hit' : ''} ${isHR ? 'is-hr' : ''} ${isWalk ? 'is-walk' : ''} ${isOut ? 'is-out' : ''}`}>
        {play.result}
      </span>
      {Number(play.rbi||0) > 0 && <span className="play-tag tag-rbi">{play.rbi} RBI</span>}
      {Number(play.runs||0) > 0 && <span className="play-tag tag-run">RUN</span>}
      {play.notes && <span className="play-note">{play.notes}</span>}
    </li>
  );
}

function BoxScoreBatting({ team, rows }) {
  if (rows.length === 0) return <div className="box-empty">No batting data for {team.name}</div>;
  const total = rows.reduce((acc, r) => ({
    pa: acc.pa + r.pa, ab: acc.ab + r.ab, hits: acc.hits + r.hits,
    runs: acc.runs + r.runs, rbi: acc.rbi + r.rbi, bb: acc.bb + r.bb, k: acc.k + r.k,
    hr: acc.hr + r.hr, twos: acc.twos + r.twos, threes: acc.threes + r.threes,
  }), {pa:0,ab:0,hits:0,runs:0,rbi:0,bb:0,k:0,hr:0,twos:0,threes:0});

  return (
    <div className="box-card">
      <div className="box-header">
        <TeamLogo team={team} size={32} className="box-team-logo"/>
        <span className="box-team-name">{team.name}</span>
      </div>
      <table className="box-table">
        <thead>
          <tr>
            <th className="th-name">BATTER</th>
            <th>AB</th><th>R</th><th>H</th><th>2B</th><th>3B</th><th>HR</th>
            <th>RBI</th><th>BB</th><th>K</th>
            <th>AVG</th><th>OPS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.player.id}>
              <td className="td-name">{r.player.name}</td>
              <td>{r.ab}</td><td>{r.runs}</td>
              <td className="cell-bold">{r.hits}</td>
              <td>{r.twos}</td><td>{r.threes}</td><td>{r.hr}</td>
              <td>{r.rbi}</td><td>{r.bb}</td><td>{r.k}</td>
              <td>{fmtAvg(r.avg)}</td>
              <td className="cell-bold">{fmtAvg(r.ops)}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td className="td-name">TEAM</td>
            <td>{total.ab}</td><td>{total.runs}</td>
            <td>{total.hits}</td>
            <td>{total.twos}</td><td>{total.threes}</td><td>{total.hr}</td>
            <td>{total.rbi}</td><td>{total.bb}</td><td>{total.k}</td>
            <td>—</td><td>—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BoxScorePitching({ team, rows }) {
  if (rows.length === 0) return <div className="box-empty">No pitching data for {team.name}</div>;
  return (
    <div className="box-card">
      <div className="box-header">
        <TeamLogo team={team} size={32} className="box-team-logo"/>
        <span className="box-team-name">{team.name}</span>
      </div>
      <table className="box-table">
        <thead>
          <tr>
            <th className="th-name">PITCHER</th>
            <th>IP</th><th>H</th><th>R</th><th>ER</th><th>HR</th><th>BB</th><th>K</th>
            <th>W</th><th>L</th><th>S</th><th>ERA</th><th>WHIP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(p => {
            const stats = calcPitching([p]);
            return (
              <tr key={p.id}>
                <td className="td-name">{p.player.name}{p.gs ? ' *' : ''}</td>
                <td className="cell-bold">{fmtIp(p.ip)}</td>
                <td>{p.h}</td><td>{p.r}</td><td>{p.er}</td><td>{p.hr}</td><td>{p.bb}</td>
                <td className="cell-bold">{p.k}</td>
                <td>{p.w || ''}</td><td>{p.l || ''}</td><td>{p.s || ''}</td>
                <td className="cell-bold">{fmtEra(stats.era)}</td>
                <td>{fmtRate(stats.whip)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// MANAGE VIEW
// ============================================================

function ManageView({ teams, setTeams, players, setPlayers, games, setGames, pas, setPAs, pitching, setPitching, openGame, resetAll, clearAll }) {
  const [tab, setTab] = useState('games');
  return (
    <div className="manage-view">
      <PageHeader eyebrow="ADMIN" title="Manage" subtitle="changes broadcast to everyone viewing this site" />
      <div className="manage-tabs">
        <button className={`mtab ${tab === 'games' ? 'is-active' : ''}`} onClick={() => setTab('games')}>Games</button>
        <button className={`mtab ${tab === 'pa' ? 'is-active' : ''}`} onClick={() => setTab('pa')}>Add PA</button>
        <button className={`mtab ${tab === 'pitch' ? 'is-active' : ''}`} onClick={() => setTab('pitch')}>Add Pitching</button>
        <button className={`mtab ${tab === 'players' ? 'is-active' : ''}`} onClick={() => setTab('players')}>Players</button>
        <button className={`mtab ${tab === 'data' ? 'is-active' : ''}`} onClick={() => setTab('data')}>Data</button>
      </div>

      {tab === 'games' && <GamesManager teams={teams} games={games} setGames={setGamesM} pas={pas} setPAs={setPAsM} pitching={pitching} setPitching={setPitchingM} openGame={openGame} />}
      {tab === 'pa' && <PAEntry teams={teams} players={players} games={games} pas={pas} setPAs={setPAsM} />}
      {tab === 'pitch' && <PitchingEntry teams={teams} players={players} games={games} pitching={pitching} setPitching={setPitchingM} />}
      {tab === 'players' && <PlayersManager teams={teams} setTeams={setTeamsM} players={players} setPlayers={setPlayersM} />}
      {tab === 'data' && <DataManager resetAll={resetAll} clearAll={clearAll} games={games} pas={pas} pitching={pitching} players={players} teams={teams} />}
    </div>
  );
}

function GamesManager({ teams, games, setGames, pas, setPAs, pitching, setPitching, openGame }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    awayTeamId: teams[0]?.id || '',
    homeTeamId: teams[1]?.id || teams[0]?.id || '',
    innings: 3,
    status: 'final',
    notes: '',
  });

  const addGame = () => {
    if (!form.awayTeamId || !form.homeTeamId) return alert('Pick both teams.');
    if (form.awayTeamId === form.homeTeamId) return alert('Away and home must differ.');
    const id = `g${Date.now()}`;
    setGames([...games, { id, ...form }]);
    setForm({ ...form, notes: '' });
  };

  const deleteGame = (id) => {
    if (!confirm('Delete this game and all its plays/pitching?')) return;
    setGames(games.filter(g => g.id !== id));
    setPAs(pas.filter(p => p.gameId !== id));
    setPitching(pitching.filter(p => p.gameId !== id));
  };

  return (
    <>
      <div className="card">
        <div className="card-title">Add New Game</div>
        <div className="form-grid">
          <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></Field>
          <Field label="Away Team">
            <select value={form.awayTeamId} onChange={e => setForm({...form, awayTeamId: e.target.value})}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Home Team">
            <select value={form.homeTeamId} onChange={e => setForm({...form, homeTeamId: e.target.value})}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Innings (regulation = 3)"><input type="number" min="1" max="20" value={form.innings} onChange={e => setForm({...form, innings: Number(e.target.value)})} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="final">Final</option>
              <option value="partial">Partial</option>
              <option value="in-progress">In Progress</option>
            </select>
          </Field>
          <Field label="Notes" full><input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="e.g. walk-off" /></Field>
        </div>
        <button className="btn btn-primary" onClick={addGame}>Add Game</button>
      </div>

      <div className="list-card">
        {games.length === 0 && <div className="empty-row">No games yet.</div>}
        {games.map(g => {
          const away = teams.find(t => t.id === g.awayTeamId);
          const home = teams.find(t => t.id === g.homeTeamId);
          return (
            <div key={g.id} className="list-row">
              <div className="list-row-content">
                <div className="list-row-title">{away?.abbr} <span className="list-row-at">@</span> {home?.abbr}</div>
                <div className="list-row-meta">{g.date}{g.innings > 3 ? ` · ${g.innings - 3} extra inn` : ''} · {g.status}</div>
              </div>
              <div className="list-row-actions">
                <button className="btn btn-ghost" onClick={() => openGame(g.id)}>Box Score →</button>
                <button className="btn btn-danger" onClick={() => deleteGame(g.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PAEntry({ teams, players, games, pas, setPAs }) {
  const [form, setForm] = useState({
    gameId: games[games.length - 1]?.id || '',
    inning: 1, half: 'T', batterId: '', pitcherId: '',
    result: '1B', rbi: 0, runs: 0, notes: '',
  });

  const game = games.find(g => g.id === form.gameId);
  const battingTeamId = form.half === 'T' ? game?.awayTeamId : game?.homeTeamId;
  const pitchingTeamId = form.half === 'T' ? game?.homeTeamId : game?.awayTeamId;
  const eligibleBatters = players.filter(p => p.teamId === battingTeamId);
  const eligiblePitchers = players.filter(p => p.teamId === pitchingTeamId);

  const addPA = () => {
    if (!form.gameId || !form.batterId || !form.pitcherId) return alert('Pick game, batter, and pitcher.');
    const id = `pa${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    setPAs([...pas, { id, ...form, rbi: Number(form.rbi||0), runs: Number(form.runs||0) }]);
    setForm({ ...form, rbi: 0, runs: 0, notes: '' });
  };

  const recentPAs = pas.filter(p => p.gameId === form.gameId).slice(-10).reverse();
  const getName = (id) => players.find(p => p.id === id)?.name || '?';

  return (
    <>
      <div className="card">
        <div className="card-title">Add Plate Appearance · sticky fields for fast entry</div>
        <div className="form-grid">
          <Field label="Game" full>
            <select value={form.gameId} onChange={e => setForm({...form, gameId: e.target.value})}>
              <option value="">— pick game —</option>
              {games.map(g => {
                const away = teams.find(t => t.id === g.awayTeamId);
                const home = teams.find(t => t.id === g.homeTeamId);
                return <option key={g.id} value={g.id}>{g.date} · {away?.abbr} @ {home?.abbr}</option>;
              })}
            </select>
          </Field>
          <Field label="Inning"><input type="number" min="1" max="20" value={form.inning} onChange={e => setForm({...form, inning: Number(e.target.value)})} /></Field>
          <Field label="Half">
            <select value={form.half} onChange={e => setForm({...form, half: e.target.value})}>
              <option value="T">Top</option>
              <option value="B">Bottom</option>
            </select>
          </Field>
          <Field label="Batter">
            <select value={form.batterId} onChange={e => setForm({...form, batterId: e.target.value})}>
              <option value="">— pick —</option>
              {eligibleBatters.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Pitcher">
            <select value={form.pitcherId} onChange={e => setForm({...form, pitcherId: e.target.value})}>
              <option value="">— pick —</option>
              {eligiblePitchers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Result">
            <select value={form.result} onChange={e => setForm({...form, result: e.target.value})}>
              {RESULT_CODES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
            </select>
          </Field>
          <Field label="RBI"><input type="number" min="0" max="4" value={form.rbi} onChange={e => setForm({...form, rbi: Number(e.target.value)})} /></Field>
          <Field label="Run scored?"><input type="number" min="0" max="1" value={form.runs} onChange={e => setForm({...form, runs: Number(e.target.value)})} /></Field>
          <Field label="Notes" full><input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></Field>
        </div>
        <button className="btn btn-primary" onClick={addPA}>Add Play</button>
      </div>

      <div className="card">
        <div className="card-title">Last 10 Plays · this game</div>
        {recentPAs.length === 0 && <div className="empty-row">No plays yet.</div>}
        <ol className="recent-list">
          {recentPAs.map(p => (
            <li key={p.id} className="recent-item">
              <span className="recent-pos">{p.half}{p.inning}</span>
              <span className="recent-name">{getName(p.batterId)}</span>
              <span className="recent-result">{p.result}</span>
              {Number(p.rbi||0) > 0 && <span className="play-tag tag-rbi">{p.rbi} RBI</span>}
              {Number(p.runs||0) > 0 && <span className="play-tag tag-run">RUN</span>}
              <button className="btn-x" onClick={() => { if (confirm('Delete this PA?')) setPAs(pas.filter(x => x.id !== p.id)); }}>×</button>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function PitchingEntry({ teams, players, games, pitching, setPitching }) {
  const [form, setForm] = useState({
    gameId: games[games.length - 1]?.id || '', pitcherId: '',
    gs: 0, ip: 0, r: 0, er: 0, h: 0, bb: 0, k: 0, hr: 0,
    cg: 0, w: 0, l: 0, s: 0, notes: '',
  });

  const game = games.find(g => g.id === form.gameId);
  const eligible = game ? players.filter(p => p.teamId === game.awayTeamId || p.teamId === game.homeTeamId) : [];

  const addPitching = () => {
    if (!form.gameId || !form.pitcherId) return alert('Pick game and pitcher.');
    const id = `pit${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    setPitching([...pitching, { id, ...form, ip: Number(form.ip), r: Number(form.r), er: Number(form.er), h: Number(form.h), bb: Number(form.bb), k: Number(form.k), hr: Number(form.hr), cg: Number(form.cg), w: Number(form.w), l: Number(form.l), s: Number(form.s), gs: Number(form.gs) }]);
    setForm({ ...form, pitcherId: '', gs: 0, ip: 0, r: 0, er: 0, h: 0, bb: 0, k: 0, hr: 0, cg: 0, w: 0, l: 0, s: 0, notes: '' });
  };

  const gamePitching = pitching.filter(p => p.gameId === form.gameId);

  return (
    <>
      <div className="card">
        <div className="card-title">Add Pitching Line · IP uses 4.1=4⅓, 4.2=4⅔</div>
        <div className="form-grid">
          <Field label="Game" full>
            <select value={form.gameId} onChange={e => setForm({...form, gameId: e.target.value})}>
              <option value="">— pick —</option>
              {games.map(g => {
                const away = teams.find(t => t.id === g.awayTeamId);
                const home = teams.find(t => t.id === g.homeTeamId);
                return <option key={g.id} value={g.id}>{g.date} · {away?.abbr} @ {home?.abbr}</option>;
              })}
            </select>
          </Field>
          <Field label="Pitcher" full>
            <select value={form.pitcherId} onChange={e => setForm({...form, pitcherId: e.target.value})}>
              <option value="">— pick —</option>
              {eligible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="GS"><input type="number" min="0" max="1" value={form.gs} onChange={e => setForm({...form, gs: Number(e.target.value)})} /></Field>
          <Field label="IP"><input type="number" step="0.1" min="0" value={form.ip} onChange={e => setForm({...form, ip: e.target.value})} /></Field>
          <Field label="R"><input type="number" min="0" value={form.r} onChange={e => setForm({...form, r: e.target.value})} /></Field>
          <Field label="ER"><input type="number" min="0" value={form.er} onChange={e => setForm({...form, er: e.target.value})} /></Field>
          <Field label="H"><input type="number" min="0" value={form.h} onChange={e => setForm({...form, h: e.target.value})} /></Field>
          <Field label="BB"><input type="number" min="0" value={form.bb} onChange={e => setForm({...form, bb: e.target.value})} /></Field>
          <Field label="K"><input type="number" min="0" value={form.k} onChange={e => setForm({...form, k: e.target.value})} /></Field>
          <Field label="HR"><input type="number" min="0" value={form.hr} onChange={e => setForm({...form, hr: e.target.value})} /></Field>
          <Field label="CG"><input type="number" min="0" max="1" value={form.cg} onChange={e => setForm({...form, cg: e.target.value})} /></Field>
          <Field label="W"><input type="number" min="0" max="1" value={form.w} onChange={e => setForm({...form, w: e.target.value})} /></Field>
          <Field label="L"><input type="number" min="0" max="1" value={form.l} onChange={e => setForm({...form, l: e.target.value})} /></Field>
          <Field label="S"><input type="number" min="0" max="1" value={form.s} onChange={e => setForm({...form, s: e.target.value})} /></Field>
          <Field label="Notes" full><input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></Field>
        </div>
        <button className="btn btn-primary" onClick={addPitching}>Add Pitching Line</button>
      </div>

      <div className="card">
        <div className="card-title">Pitching Lines · this game</div>
        {gamePitching.length === 0 && <div className="empty-row">No lines yet.</div>}
        <ol className="recent-list">
          {gamePitching.map(p => {
            const pl = players.find(pp => pp.id === p.pitcherId);
            return (
              <li key={p.id} className="recent-item">
                <span className="recent-name">{pl?.name}</span>
                <span className="recent-meta">{fmtIp(p.ip)} IP · {p.k}K · {p.bb}BB · {p.h}H · {p.er}ER</span>
                <button className="btn-x" onClick={() => { if (confirm('Delete?')) setPitching(pitching.filter(x => x.id !== p.id)); }}>×</button>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}

function PlayersManager({ teams, setTeams, players, setPlayers }) {
  const [pForm, setPForm] = useState({ name: '', teamId: teams[0]?.id || '' });
  const [tForm, setTForm] = useState({ name: '', abbr: '', primary: '#1D4ED8', logoKey: '' });

  const addPlayer = () => {
    if (!pForm.name.trim()) return;
    const id = `pl${Date.now()}`;
    setPlayers([...players, { id, name: pForm.name.trim(), teamId: pForm.teamId }]);
    setPForm({ ...pForm, name: '' });
  };

  const deletePlayer = (id) => {
    if (!confirm('Delete this player?')) return;
    setPlayers(players.filter(p => p.id !== id));
  };

  const addTeam = () => {
    if (!tForm.name.trim() || !tForm.abbr.trim()) return alert('Name and abbreviation required.');
    const id = `t${Date.now()}`;
    setTeams([...teams, { id, name: tForm.name.trim(), abbr: tForm.abbr.toUpperCase().slice(0,4), primary: tForm.primary, accent: tForm.primary, logoKey: tForm.logoKey || undefined }]);
    setTForm({ name: '', abbr: '', primary: '#1D4ED8', logoKey: '' });
  };

  const usePreset = (preset) => {
    setTForm({
      name: preset.name,
      abbr: preset.abbr,
      primary: preset.primary,
      logoKey: preset.logoKey,
    });
  };

  const usableLogos = Object.keys(TEAM_LOGOS);

  return (
    <>
      <div className="card">
        <div className="card-title">Add Team</div>
        <div className="form-grid">
          <Field label="Team Name"><input type="text" value={tForm.name} onChange={e => setTForm({...tForm, name: e.target.value})} /></Field>
          <Field label="Abbreviation (3-4 letters)"><input type="text" value={tForm.abbr} onChange={e => setTForm({...tForm, abbr: e.target.value.toUpperCase().slice(0,4)})} maxLength={4} /></Field>
          <Field label="Primary Color"><input type="color" value={tForm.primary} onChange={e => setTForm({...tForm, primary: e.target.value})} /></Field>
        </div>
        <div className="presets-block">
          <div className="presets-label">Quick add (loads name, color & logo):</div>
          <div className="presets-row">
            {TEAM_PRESETS.filter(p => !teams.find(t => t.logoKey === p.logoKey)).map(p => (
              <button key={p.name} className="preset-chip" onClick={() => usePreset(p)} type="button">
                {TEAM_LOGOS[p.logoKey] && <img src={TEAM_LOGOS[p.logoKey]} alt="" className="preset-chip-logo"/>}
                <span className="preset-chip-name">{p.name}</span>
                <span className="preset-chip-swatch" style={{background: p.primary}}/>
              </button>
            ))}
          </div>
        </div>
        <Field label="Logo">
          <select value={tForm.logoKey} onChange={e => setTForm({...tForm, logoKey: e.target.value})}>
            <option value="">— no logo —</option>
            {usableLogos.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <button className="btn btn-primary" onClick={addTeam}>Add Team</button>
      </div>

      <div className="list-card">
        {teams.map(t => (
          <div key={t.id} className="list-row">
            <div className="list-row-content">
              <div className="list-row-title">
                <TeamLogo team={t} size={28}/>
                <span>{t.abbr} · {t.name}</span>
              </div>
            </div>
            <button className="btn btn-danger" onClick={() => { if (confirm(`Delete ${t.name}?`)) setTeams(teams.filter(x => x.id !== t.id)); }}>Delete</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Add Player</div>
        <div className="form-grid">
          <Field label="Name"><input type="text" value={pForm.name} onChange={e => setPForm({...pForm, name: e.target.value})} /></Field>
          <Field label="Team">
            <select value={pForm.teamId} onChange={e => setPForm({...pForm, teamId: e.target.value})}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        <button className="btn btn-primary" onClick={addPlayer}>Add Player</button>
      </div>

      {teams.map(team => {
        const teamPlayers = players.filter(p => p.teamId === team.id);
        if (teamPlayers.length === 0) return null;
        return (
          <div key={team.id} className="list-card">
            <div className="list-card-header">
              <span className="list-color" style={{background: team.primary}}/>
              {team.name}
            </div>
            {teamPlayers.map(p => (
              <div key={p.id} className="list-row">
                <div className="list-row-content">
                  <div className="list-row-title">{p.name}</div>
                </div>
                <button className="btn btn-danger" onClick={() => deletePlayer(p.id)}>Delete</button>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function DataManager({ resetAll, clearAll, games, pas, pitching, players, teams }) {
  const exportData = () => {
    const data = { teams, players, games, pas, pitching, exportedAt: new Date().toISOString() };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      alert('Backup copied to clipboard.');
    });
  };

  const stats = [
    { label: 'TEAMS', value: teams.length },
    { label: 'PLAYERS', value: players.length },
    { label: 'GAMES', value: games.length },
    { label: 'PLAYS', value: pas.length },
    { label: 'PITCH LINES', value: pitching.length },
  ];

  return (
    <>
      <div className="card">
        <div className="card-title">Data Overview</div>
        <div className="data-stats">
          {stats.map(s => (
            <div key={s.label} className="data-stat">
              <div className="data-stat-num">{s.value}</div>
              <div className="data-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Backup</div>
        <p className="card-text">Copy all data as JSON to your clipboard.</p>
        <button className="btn btn-primary" onClick={exportData}>Copy Backup</button>
      </div>

      <div className="card card-danger">
        <div className="card-title">Danger Zone · Affects All Viewers</div>
        <p className="card-text">Reset goes back to seed data. Clear wipes everything. Both broadcast to anyone using this site.</p>
        <div className="card-buttons">
          <button className="btn btn-warn" onClick={resetAll}>Reset to Seed</button>
          <button className="btn btn-danger" onClick={clearAll}>Clear All</button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`field ${full ? 'field-full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function LoginModal({ onCancel, onSuccess }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    const ok = await attemptLogin(pw);
    setBusy(false);
    if (ok) onSuccess();
    else setError('Wrong password');
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Sign in to edit</div>
        <p className="modal-text">Enter the league password to add or edit games.</p>
        <input
          type="password"
          className="modal-input"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          autoFocus
        />
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-buttons">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
