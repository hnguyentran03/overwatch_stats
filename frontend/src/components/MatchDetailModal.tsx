import React, { useState, useEffect } from 'react';
import { getMatchDetails } from '../api/client';
import type { MatchDetails, MatchDetailPlayer } from '../types';

const roleOrder: Record<string, number> = { tank: 0, dps: 1, support: 2 };

const MatchDetailModal = ({ matchId, battleTag, onClose }: { matchId: number; battleTag: string; onClose: () => void }) => {
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getMatchDetails(matchId)
      .then(setDetails)
      .catch(() => setError('Failed to load match details.'))
      .finally(() => setLoading(false));
  }, [matchId]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatNumber = (n: number) => Math.round(n).toLocaleString();
  const formatTime = (minutes: number) => {
    const m = Math.floor(minutes);
    const s = Math.round((minutes % 1) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const outcomeLabel = (outcome: string, score: string) => {
    if (outcome === 'win')  return `✓ WIN  ${score}`;
    if (outcome === 'draw') return `= DRAW  ${score}`;
    return `✗ LOSS  ${score}`;
  };

  const sortedPlayers = (players: MatchDetailPlayer[]) =>
    [...players].sort((a, b) => {
      if (a.team !== b.team) return a.team === 'team1' ? -1 : 1;
      return roleOrder[a.primary_hero_role] - roleOrder[b.primary_hero_role];
    });

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>✕</button>

        {loading && <div className="loading">Loading match details...</div>}
        {error && <div className="error">{error}</div>}

        {details && (
          <>
            <div className="modal-header">
              <div className={`modal-outcome outcome-${details.outcome}`}>
                {outcomeLabel(details.outcome, details.final_score)}
              </div>
              <div className="modal-map">
                <span className="modal-map-name">{details.map_name}</span>
                <span className="map-type">{details.map_type}</span>
              </div>
              <div className="modal-meta">
                <span>{new Date(details.date_time).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                <span className="match-time-of-day">{new Date(details.date_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                <span>{formatTime(details.duration)} duration</span>
                <span className={`mode-badge mode-${details.game_mode}`}>
                  {details.game_mode === 'ranked' ? 'Ranked' : 'Unranked'}
                </span>
                <span className={`size-badge size-${details.team_size}`}>{details.team_size}</span>
              </div>
            </div>

            <div className="modal-players-section">
              <h3>Player Performance</h3>
              <div className="modal-table-wrapper">
                <table className="modal-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Hero</th>
                      <th>Role</th>
                      <th>Elims</th>
                      <th>Assists</th>
                      <th>Deaths</th>
                      <th>Final Blows</th>
                      <th>Damage</th>
                      <th>Healing</th>
                      <th>Mitigation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers(details.players).map((p, i, arr) => {
                      const isFirstOfTeam = i === 0 || arr[i - 1].team !== p.team;
                      const isExpandable = p.heroes.length > 1;
                      const isExpanded = expandedPlayer === p.player_id;
                      return (
                        <React.Fragment key={i}>
                          {isFirstOfTeam && (
                            <tr className={`team-header-row team-header-${p.team}`}>
                              <td colSpan={10}>
                                {p.team === 'team1' ? 'Your Team' : 'Enemy Team'}
                              </td>
                            </tr>
                          )}
                          <tr
                            className={`team-row-${p.team}${isExpandable ? ' clickable-row' : ''}`}
                            onClick={isExpandable ? () => setExpandedPlayer(isExpanded ? null : p.player_id) : undefined}
                            title={isExpandable ? 'Click to see per-hero breakdown' : undefined}
                          >
                            <td className="modal-player-tag">{p.battle_tag}</td>
                            <td>
                              <strong>{p.primary_hero}</strong>
                              {p.heroes.length > 1 && (
                                <span className="hero-swap-badge">+{p.heroes.length - 1}</span>
                              )}
                              {isExpandable && <span className="expand-chevron">{isExpanded ? ' ▲' : ' ▼'}</span>}
                            </td>
                            <td>
                              <span className={`role-badge role-${p.primary_hero_role}`}>
                                {p.primary_hero_role.toUpperCase()}
                              </span>
                            </td>
                            <td>{p.eliminations}</td>
                            <td>{p.assists}</td>
                            <td>{p.deaths}</td>
                            <td>{p.final_blows}</td>
                            <td>{formatNumber(p.damage_done)}</td>
                            <td>{formatNumber(p.healing_done)}</td>
                            <td>{formatNumber(p.damage_mitigated)}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="hero-breakdown-row">
                              <td colSpan={10} className="hero-breakdown-cell">
                                <table className="hero-breakdown-table">
                                  <thead>
                                    <tr>
                                      <th>Hero</th>
                                      <th>Role</th>
                                      <th>Time</th>
                                      <th>Elims</th>
                                      <th>Assists</th>
                                      <th>Deaths</th>
                                      <th>Final Blows</th>
                                      <th>Damage</th>
                                      <th>Healing</th>
                                      <th>Mitigation</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.heroes.map((h, j) => (
                                      <tr key={j}>
                                        <td><strong>{h.hero_name}</strong></td>
                                        <td>
                                          <span className={`role-badge role-${h.hero_role}`}>
                                            {h.hero_role.toUpperCase()}
                                          </span>
                                        </td>
                                        <td>{formatTime(h.time_played)}</td>
                                        <td>{h.eliminations}</td>
                                        <td>{h.assists}</td>
                                        <td>{h.deaths}</td>
                                        <td>{h.final_blows}</td>
                                        <td>{formatNumber(h.damage_done)}</td>
                                        <td>{formatNumber(h.healing_done)}</td>
                                        <td>{formatNumber(h.damage_mitigated)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {(details.bans.team1.length > 0 || details.bans.team2.length > 0) && (
              <div className="modal-bans-section">
                <h3>Hero Bans</h3>
                <div className="modal-bans-grid">
                  {(['team1', 'team2'] as const).map((team, ti) => (
                    <div key={team} className="modal-bans-team">
                      <h4>{ti === 0 ? 'Your Team' : 'Enemy Team'}</h4>
                      {details.bans[team].length === 0
                        ? <span className="no-data">No bans</span>
                        : details.bans[team].map((b, i) => (
                          <div key={i} className="ban-entry">
                            <span className={`role-badge role-${b.role}`}>{b.role.toUpperCase()}</span>
                            <span>{b.hero_name}</span>
                          </div>
                        ))
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MatchDetailModal;
