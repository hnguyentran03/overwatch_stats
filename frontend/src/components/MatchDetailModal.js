import React, { useState, useEffect } from 'react';
import { getMatchDetails } from '../api/client';

const roleOrder = { tank: 0, dps: 1, support: 2 };

const MatchDetailModal = ({ matchId, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
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

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatNumber = (n) => Math.round(n).toLocaleString();
  const formatTime = (minutes) => {
    const m = Math.floor(minutes);
    const s = Math.round((minutes % 1) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const outcomeLabel = (outcome, score) => {
    if (outcome === 'win')  return `✓ WIN  ${score}`;
    if (outcome === 'tie')  return `= TIE  ${score}`;
    return `✗ LOSS  ${score}`;
  };

  const sortedPlayers = (players) =>
    [...players].sort((a, b) => {
      if (a.team !== b.team) return a.team === 'team1' ? -1 : 1;
      return roleOrder[a.hero_role] - roleOrder[b.hero_role];
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
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers(details.players).map((p, i, arr) => {
                      const isFirstOfTeam = i === 0 || arr[i - 1].team !== p.team;
                      return (
                        <React.Fragment key={i}>
                          {isFirstOfTeam && (
                            <tr className={`team-header-row team-header-${p.team}`}>
                              <td colSpan={11}>
                                {p.team === 'team1' ? 'Your Team' : 'Enemy Team'}
                              </td>
                            </tr>
                          )}
                          <tr className={`team-row-${p.team}`}>
                            <td className="modal-player-tag">{p.battle_tag}</td>
                            <td><strong>{p.hero_name}</strong></td>
                            <td>
                              <span className={`role-badge role-${p.hero_role}`}>
                                {p.hero_role.toUpperCase()}
                              </span>
                            </td>
                            <td>{p.eliminations}</td>
                            <td>{p.assists}</td>
                            <td>{p.deaths}</td>
                            <td>{p.final_blows}</td>
                            <td>{formatNumber(p.damage_done)}</td>
                            <td>{formatNumber(p.healing_done)}</td>
                            <td>{formatNumber(p.damage_mitigated)}</td>
                            <td>{formatTime(p.time_played)}</td>
                          </tr>
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
                  {['team1', 'team2'].map((team, ti) => (
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
