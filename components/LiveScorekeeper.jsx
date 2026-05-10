'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  createGame, setLineup, setStarter, startGame, computeState,
  paEvent, pitchingChangeEvent, substitutionEvent, endHalfEvent, endGameEvent,
  PA_RESULTS,
} from '../lib/livegame';
import { TEAM_LOGOS } from '../lib/logos';

// =========================================================================
// API helpers
// =========================================================================

async function apiGetLiveGame() {
  const res = await fetch('/api/livegame', { cache: 'no-store' });
  if (!res.ok) throw new Error('load failed');
  const { game } = await res.json();
  return game;
}

async function apiPostLiveGame(game) {
  const res = await fetch('/api/livegame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game }),
  });
  if (!res.ok) throw new Error(`save failed (${res.status})`);
}

async function apiAppendEvents(events) {
  const res = await fetch('/api/livegame', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error(`append failed (${res.status})`);
  return res.json();
}

async function apiFinalize() {
  const res = await fetch('/api/livegame', { method: 'DELETE' });
  if (!res.ok) throw new Error('finalize failed');
  return res.json();
}

async function apiDiscard() {
  const res = await fetch('/api/livegame?discard=1', { method: 'DELETE' });
  if (!res.ok) throw new Error('discard failed');
  return res.json();
}

// =========================================================================
// MAIN COMPONENT
// =========================================================================

export default function LiveScorekeeper({ teams, players, canEdit, onClose, onFinalized }) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Initial load + polling for live updates (every 5s)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const g = await apiGetLiveGame();
        if (!cancelled) setGame(g);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const updateGame = useCallback(async (next) => {
    setGame(next);
    setBusy(true);
    try {
      await apiPostLiveGame(next);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const appendEvents = useCallback(async (events) => {
    if (!game) return;
    // Optimistic update
    const optimistic = { ...game, events: [...game.events, ...events] };
    setGame(optimistic);
    setBusy(true);
    try {
      const { game: server } = await apiAppendEvents(events);
      setGame(server);
      setError('');
    } catch (e) {
      setError(e.message);
      // Revert on failure
      setGame(game);
    } finally {
      setBusy(false);
    }
  }, [game]);

  const undoLastEvent = useCallback(async () => {
    if (!game || game.events.length === 0) return;
    if (!confirm('Undo the last play?')) return;
    const next = { ...game, events: game.events.slice(0, -1) };
    await updateGame(next);
  }, [game, updateGame]);

  const startNewGame = async (config) => {
    let g = createGame(config);
    g = setLineup(g, 'away', config.awayLineup);
    g = setLineup(g, 'home', config.homeLineup);
    g = setStarter(g, 'away', config.awayStarter);
    g = setStarter(g, 'home', config.homeStarter);
    g = startGame(g);
    await updateGame(g);
  };

  const finalize = async () => {
    if (!confirm('Finalize this game? It will be saved to season stats and the live game cleared.')) return;
    setBusy(true);
    try {
      await apiFinalize();
      setGame(null);
      if (onFinalized) onFinalized();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!confirm('Discard this live game without saving? This cannot be undone.')) return;
    setBusy(true);
    try {
      await apiDiscard();
      setGame(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="live-loading">Loading live game…</div>;
  }

  // No game yet → setup screen
  if (!game) {
    if (!canEdit) {
      return (
        <div className="live-empty">
          <h2>No Live Game</h2>
          <p>There's no game in progress right now. Sign in to start one.</p>
          {onClose && <button className="btn btn-ghost" onClick={onClose}>Back</button>}
        </div>
      );
    }
    return (
      <SetupScreen teams={teams} players={players} onStart={startNewGame} onCancel={onClose} />
    );
  }

  // Game exists → scoring or viewing
  if (game.status === 'setup') {
    return (
      <div className="live-empty">
        <h2>Setup in progress</h2>
        <p>A game is being configured. Refresh to see updates.</p>
        {canEdit && <button className="btn btn-danger" onClick={discard}>Discard Setup</button>}
      </div>
    );
  }

  return (
    <ScoringScreen
      game={game}
      teams={teams}
      players={players}
      canEdit={canEdit}
      busy={busy}
      error={error}
      onAppendEvents={appendEvents}
      onUndo={undoLastEvent}
      onFinalize={finalize}
      onDiscard={discard}
      onClose={onClose}
    />
  );
}

// =========================================================================
// SETUP SCREEN
// =========================================================================

function SetupScreen({ teams, players, onStart, onCancel }) {
  const [awayTeamId, setAwayTeamId] = useState(teams[0]?.id || '');
  const [homeTeamId, setHomeTeamId] = useState(teams[1]?.id || teams[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [awayLineup, setAwayLineup] = useState([]);
  const [homeLineup, setHomeLineup] = useState([]);
  const [awayStarter, setAwayStarter] = useState('');
  const [homeStarter, setHomeStarter] = useState('');
  const [step, setStep] = useState('teams'); // teams | lineups | review

  const awayPlayers = players.filter(p => p.teamId === awayTeamId);
  const homePlayers = players.filter(p => p.teamId === homeTeamId);

  const togglePlayer = (side, playerId) => {
    if (side === 'away') {
      setAwayLineup(prev => prev.includes(playerId) ? prev.filter(x => x !== playerId) : [...prev, playerId]);
    } else {
      setHomeLineup(prev => prev.includes(playerId) ? prev.filter(x => x !== playerId) : [...prev, playerId]);
    }
  };

  const movePlayer = (side, idx, dir) => {
    const list = side === 'away' ? [...awayLineup] : [...homeLineup];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    if (side === 'away') setAwayLineup(list); else setHomeLineup(list);
  };

  const canProceed = () => {
    if (step === 'teams') return awayTeamId && homeTeamId && awayTeamId !== homeTeamId;
    if (step === 'lineups') return awayLineup.length >= 1 && homeLineup.length >= 1 && awayStarter && homeStarter;
    return true;
  };

  const handleStart = async () => {
    try {
      await onStart({
        id: `g-live-${Date.now()}`,
        awayTeamId, homeTeamId, date,
        awayLineup, homeLineup,
        awayStarter, homeStarter,
        regulationInnings: 3,
      });
    } catch (e) {
      alert('Start failed: ' + e.message);
    }
  };

  return (
    <div className="live-setup">
      <div className="setup-header">
        <h2>Start Live Game</h2>
        <div className="setup-steps">
          <span className={step === 'teams' ? 'is-active' : ''}>1 · Teams</span>
          <span className={step === 'lineups' ? 'is-active' : ''}>2 · Lineups</span>
          <span className={step === 'review' ? 'is-active' : ''}>3 · Play Ball</span>
        </div>
      </div>

      {step === 'teams' && (
        <div className="setup-card">
          <div className="setup-row">
            <label className="setup-label">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="setup-input"/>
          </div>
          <div className="setup-row">
            <label className="setup-label">Away Team</label>
            <select value={awayTeamId} onChange={e => setAwayTeamId(e.target.value)} className="setup-input">
              <option value="">— pick —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="setup-row">
            <label className="setup-label">Home Team</label>
            <select value={homeTeamId} onChange={e => setHomeTeamId(e.target.value)} className="setup-input">
              <option value="">— pick —</option>
              {teams.filter(t => t.id !== awayTeamId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="setup-actions">
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" disabled={!canProceed()} onClick={() => setStep('lineups')}>Next →</button>
          </div>
        </div>
      )}

      {step === 'lineups' && (
        <div className="setup-lineups">
          <LineupPicker
            team={teams.find(t => t.id === awayTeamId)}
            label="AWAY"
            roster={awayPlayers}
            lineup={awayLineup}
            starter={awayStarter}
            onToggle={(pid) => togglePlayer('away', pid)}
            onMove={(idx, dir) => movePlayer('away', idx, dir)}
            onSetStarter={setAwayStarter}
          />
          <LineupPicker
            team={teams.find(t => t.id === homeTeamId)}
            label="HOME"
            roster={homePlayers}
            lineup={homeLineup}
            starter={homeStarter}
            onToggle={(pid) => togglePlayer('home', pid)}
            onMove={(idx, dir) => movePlayer('home', idx, dir)}
            onSetStarter={setHomeStarter}
          />
          <div className="setup-actions setup-actions-wide">
            <button className="btn btn-ghost" onClick={() => setStep('teams')}>← Back</button>
            <button className="btn btn-primary" disabled={!canProceed()} onClick={handleStart}>
              PLAY BALL ⚾
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LineupPicker({ team, label, roster, lineup, starter, onToggle, onMove, onSetStarter }) {
  if (!team) return null;
  return (
    <div className="lineup-card">
      <div className="lineup-card-header" style={{borderColor: team.primary}}>
        {team.logoKey && TEAM_LOGOS[team.logoKey] ? (
          <img src={TEAM_LOGOS[team.logoKey]} alt={team.abbr} className="lineup-card-logo"/>
        ) : (
          <span className="lineup-card-dot" style={{background: team.primary}}/>
        )}
        <div className="lineup-card-title">
          <div className="lineup-card-team">{team.name}</div>
          <div className="lineup-card-side">{label}</div>
        </div>
      </div>

      <div className="lineup-section">
        <div className="lineup-section-label">Batting Order ({lineup.length})</div>
        {lineup.length === 0 && <div className="lineup-empty">Tap players below to add</div>}
        <ol className="lineup-list">
          {lineup.map((pid, idx) => {
            const player = roster.find(p => p.id === pid);
            return (
              <li key={pid} className="lineup-item">
                <span className="lineup-num">{idx + 1}</span>
                <span className="lineup-name">{player?.name || pid}</span>
                <div className="lineup-actions">
                  <button onClick={() => onMove(idx, -1)} disabled={idx === 0}>↑</button>
                  <button onClick={() => onMove(idx, 1)} disabled={idx === lineup.length - 1}>↓</button>
                  <button onClick={() => onToggle(pid)} className="lineup-remove">×</button>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="lineup-section">
        <div className="lineup-section-label">Roster · tap to add</div>
        <div className="roster-grid">
          {roster.filter(p => !lineup.includes(p.id)).map(p => (
            <button key={p.id} className="roster-chip" onClick={() => onToggle(p.id)}>
              + {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="lineup-section">
        <div className="lineup-section-label">Starting Pitcher</div>
        <select value={starter} onChange={e => onSetStarter(e.target.value)} className="setup-input">
          <option value="">— pick —</option>
          {roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    </div>
  );
}

// =========================================================================
// SCORING SCREEN
// =========================================================================

function ScoringScreen({ game, teams, players, canEdit, busy, error, onAppendEvents, onUndo, onFinalize, onDiscard, onClose }) {
  const state = useMemo(() => computeState(game), [game]);
  const away = teams.find(t => t.id === game.awayTeamId);
  const home = teams.find(t => t.id === game.homeTeamId);
  const battingTeam = state.battingSide === 'away' ? away : home;
  const fieldingTeam = state.fieldingSide === 'away' ? away : home;

  const getPlayer = (id) => players.find(p => p.id === id);

  const currentBatter = getPlayer(state.currentBatterId);
  const currentPitcher = getPlayer(state.currentPitcherId);

  // Runners on bases (player objects)
  const runners = {
    '1B': state.bases['1B'] ? getPlayer(state.bases['1B']) : null,
    '2B': state.bases['2B'] ? getPlayer(state.bases['2B']) : null,
    '3B': state.bases['3B'] ? getPlayer(state.bases['3B']) : null,
  };

  // Result button handler — generates a PA event
  const recordResult = async (result, opts = {}) => {
    if (!canEdit || state.isOver) return;
    const ev = paEvent({
      batterId: state.currentBatterId,
      pitcherId: state.currentPitcherId,
      result,
      ...opts,
    });
    await onAppendEvents([ev]);
  };

  const [advanceMode, setAdvanceMode] = useState(false); // if on, ground outs advance runners

  // Pitching change modal
  const [showPitchChange, setShowPitchChange] = useState(false);

  return (
    <div className="scoring-screen">
      {/* HEADER: scoreboard */}
      <div className="scoring-header">
        <div className="sb-team sb-away" style={{ borderColor: away?.primary }}>
          {away?.logoKey && TEAM_LOGOS[away.logoKey] ? (
            <img src={TEAM_LOGOS[away.logoKey]} alt={away.abbr} className="sb-logo"/>
          ) : <span className="sb-dot" style={{background: away?.primary}}/>}
          <div className="sb-team-info">
            <div className="sb-abbr">{away?.abbr}</div>
            <div className="sb-name">{away?.name}</div>
          </div>
          <div className="sb-score">{state.score.away}</div>
        </div>

        <div className="sb-status">
          <div className="sb-inning">
            <span className="sb-arrow">{state.half === 'T' ? '▲' : '▼'}</span>
            <span className="sb-inning-num">{state.inning}</span>
          </div>
          <div className="sb-outs">
            {[0,1,2].map(i => (
              <span key={i} className={`sb-out-dot ${i < state.outs ? 'is-on' : ''}`}/>
            ))}
            <span className="sb-outs-label">{state.outs} OUT{state.outs === 1 ? '' : 'S'}</span>
          </div>
          {state.isOver && <div className="sb-final">FINAL</div>}
          {!state.isOver && <div className="sb-live"><span className="sb-live-dot"/> LIVE</div>}
        </div>

        <div className="sb-team sb-home" style={{ borderColor: home?.primary }}>
          <div className="sb-score">{state.score.home}</div>
          <div className="sb-team-info sb-team-info-r">
            <div className="sb-abbr">{home?.abbr}</div>
            <div className="sb-name">{home?.name}</div>
          </div>
          {home?.logoKey && TEAM_LOGOS[home.logoKey] ? (
            <img src={TEAM_LOGOS[home.logoKey]} alt={home.abbr} className="sb-logo"/>
          ) : <span className="sb-dot" style={{background: home?.primary}}/>}
        </div>
      </div>

      {/* DIAMOND with baserunners */}
      <div className="diamond-section">
        <div className="diamond-wrap">
          <Diamond runners={runners} battingTeam={battingTeam}/>
        </div>

        <div className="now-batting">
          <div className="now-label">NOW BATTING</div>
          {currentBatter ? (
            <div className="now-batter">{currentBatter.name}</div>
          ) : (
            <div className="now-batter dim">— no batter set —</div>
          )}
          <div className="now-meta">
            {battingTeam?.abbr} · batter #{(state.nextBatterIndex[state.battingSide]) + 1} of {game.lineups[state.battingSide].length}
          </div>

          <div className="now-pitching">
            <div className="now-label">PITCHING</div>
            <div className="now-pitcher">{currentPitcher?.name || '—'}</div>
            <div className="now-meta">{fieldingTeam?.abbr}</div>
          </div>
        </div>
      </div>

      {error && <div className="scoring-error">{error}</div>}

      {/* RESULT BUTTONS */}
      {canEdit && !state.isOver && (
        <div className="result-pad">
          <div className="result-pad-section">
            <div className="result-pad-label">HIT</div>
            <div className="result-pad-grid">
              <ResultBtn label="1B" tone="hit" onClick={() => recordResult('1B')}/>
              <ResultBtn label="2B" tone="hit" onClick={() => recordResult('2B')}/>
              <ResultBtn label="3B" tone="hit" onClick={() => recordResult('3B')}/>
              <ResultBtn label="HR" tone="hr" onClick={() => recordResult('HR')}/>
            </div>
          </div>

          <div className="result-pad-section">
            <div className="result-pad-label">REACH</div>
            <div className="result-pad-grid">
              <ResultBtn label="BB" tone="walk" onClick={() => recordResult('BB')}/>
              <ResultBtn label="HBP" tone="walk" onClick={() => recordResult('HBP')}/>
              <ResultBtn label="ROE" tone="walk" onClick={() => recordResult('ROE')}/>
            </div>
          </div>

          <div className="result-pad-section">
            <div className="result-pad-label">OUT</div>
            <div className="result-pad-grid">
              <ResultBtn label="K" tone="out" onClick={() => recordResult('K')}/>
              <ResultBtn label="GO" tone="out" onClick={() => recordResult('GO', { advanceRunners: advanceMode })}/>
              <ResultBtn label="FO" tone="out" onClick={() => recordResult('FO')}/>
              <ResultBtn label="FC" tone="out" onClick={() => recordResult('FC')}/>
              <ResultBtn label="SF" tone="out" onClick={() => recordResult('SF')}/>
            </div>
            <label className="advance-toggle">
              <input type="checkbox" checked={advanceMode} onChange={e => setAdvanceMode(e.target.checked)}/>
              <span>Runners advance on ground outs</span>
            </label>
          </div>
        </div>
      )}

      {/* GAME CONTROLS */}
      {canEdit && (
        <div className="game-controls">
          <button className="btn btn-ghost" onClick={onUndo} disabled={busy || game.events.length === 0}>
            ↶ Undo last
          </button>
          <button className="btn btn-ghost" onClick={() => setShowPitchChange(true)} disabled={state.isOver}>
            Pitching change
          </button>
          {!state.isOver && (
            <button className="btn btn-warn" onClick={() => onAppendEvents([endHalfEvent()])} disabled={busy}>
              End half
            </button>
          )}
          {state.isOver && (
            <button className="btn btn-primary" onClick={onFinalize} disabled={busy}>
              Save Game to Stats →
            </button>
          )}
          <button className="btn btn-danger" onClick={onDiscard}>Discard</button>
        </div>
      )}

      {/* RECENT PLAYS */}
      <div className="recent-plays">
        <div className="recent-plays-label">RECENT PLAYS</div>
        <ol className="recent-plays-list">
          {[...game.events].reverse().slice(0, 8).map(ev => (
            <RecentPlay key={ev.id} ev={ev} getPlayer={getPlayer}/>
          ))}
          {game.events.length === 0 && <li className="recent-empty">No plays yet — tap a result button to start.</li>}
        </ol>
      </div>

      {showPitchChange && (
        <PitchingChangeModal
          team={fieldingTeam}
          roster={players.filter(p => p.teamId === fieldingTeam.id)}
          currentPitcherId={state.currentPitcherId}
          onCancel={() => setShowPitchChange(false)}
          onConfirm={async (newPid) => {
            await onAppendEvents([pitchingChangeEvent({ team: state.fieldingSide, pitcherId: newPid })]);
            setShowPitchChange(false);
          }}
        />
      )}

      {onClose && (
        <button className="back-btn back-btn-floating" onClick={onClose}>← Back to site</button>
      )}
    </div>
  );
}

function ResultBtn({ label, tone, onClick }) {
  return (
    <button className={`result-btn tone-${tone}`} onClick={onClick}>
      {label}
    </button>
  );
}

function RecentPlay({ ev, getPlayer }) {
  if (ev.type === 'pa') {
    const b = getPlayer(ev.batterId);
    return (
      <li className="recent-play">
        <span className="recent-play-result">{ev.result}</span>
        <span className="recent-play-name">{b?.name || ev.batterId}</span>
        {ev.notes && <span className="recent-play-note">— {ev.notes}</span>}
      </li>
    );
  }
  if (ev.type === 'pitching_change') {
    const p = getPlayer(ev.pitcherId);
    return <li className="recent-play recent-play-sub">PITCHING CHANGE → {p?.name || ev.pitcherId}</li>;
  }
  if (ev.type === 'substitution') {
    const p = getPlayer(ev.playerId);
    return <li className="recent-play recent-play-sub">SUB → {p?.name || ev.playerId}</li>;
  }
  if (ev.type === 'end_half') {
    return <li className="recent-play recent-play-sub">— end of half —</li>;
  }
  if (ev.type === 'end_game') {
    return <li className="recent-play recent-play-sub">— game ended —</li>;
  }
  return null;
}

function Diamond({ runners, battingTeam }) {
  const color = battingTeam?.primary || '#999';
  return (
    <svg viewBox="0 0 200 200" className="diamond-svg">
      {/* Diamond outline */}
      <polygon points="100,30 170,100 100,170 30,100" fill="none" stroke="#CBD5E1" strokeWidth="2"/>
      {/* Bases */}
      {/* Home */}
      <rect x="92" y="162" width="16" height="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2"/>
      {/* 1B */}
      <rect x="162" y="92" width="16" height="16" fill={runners['1B'] ? color : '#FFFFFF'} stroke="#CBD5E1" strokeWidth="2"/>
      {/* 2B */}
      <rect x="92" y="22" width="16" height="16" fill={runners['2B'] ? color : '#FFFFFF'} stroke="#CBD5E1" strokeWidth="2"/>
      {/* 3B */}
      <rect x="22" y="92" width="16" height="16" fill={runners['3B'] ? color : '#FFFFFF'} stroke="#CBD5E1" strokeWidth="2"/>

      {/* Mound */}
      <circle cx="100" cy="100" r="8" fill="#E5E7E0" stroke="#CBD5E1"/>

      {/* Runner labels */}
      {runners['1B'] && <text x="170" y="86" textAnchor="middle" className="diamond-runner">{runners['1B'].name.split(' ').pop()}</text>}
      {runners['2B'] && <text x="100" y="16" textAnchor="middle" className="diamond-runner">{runners['2B'].name.split(' ').pop()}</text>}
      {runners['3B'] && <text x="30" y="86" textAnchor="middle" className="diamond-runner">{runners['3B'].name.split(' ').pop()}</text>}
    </svg>
  );
}

function PitchingChangeModal({ team, roster, currentPitcherId, onCancel, onConfirm }) {
  const [selected, setSelected] = useState('');
  const eligible = roster.filter(p => p.id !== currentPitcherId);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Pitching Change · {team?.name}</div>
        <p className="modal-text">Choose the new pitcher.</p>
        <select value={selected} onChange={e => setSelected(e.target.value)} className="modal-input">
          <option value="">— pick —</option>
          {eligible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="modal-buttons">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={!selected} onClick={() => onConfirm(selected)}>Bring in</button>
        </div>
      </div>
    </div>
  );
}
