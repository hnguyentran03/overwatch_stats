import React, { useState } from 'react';

const PAGE_SIZE = 20;

const MatchHistory = ({ matches, onMatchClick }) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!matches || matches.length === 0) {
    return <div>No match history available.</div>;
  }

  const visibleMatches = matches.slice(0, visibleCount);
  const hasMore = visibleCount < matches.length;

  return (
    <div className="match-history">
      <h2>Match History</h2>
      <h3 style={{ textAlign: 'center', color: '#ff9c00', marginBottom: '20px' }}>
        Showing {visibleMatches.length} of {matches.length} Matches
      </h3>
      <div className="matches-table-wrapper">
        <table className="matches-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Map</th>
            <th>Hero</th>
            <th>Result</th>
            <th>Score</th>
            <th>K/A/D</th>
            <th>Damage</th>
            <th>Healing</th>
          </tr>
        </thead>
        <tbody>
          {visibleMatches.map((match) => (
            <tr
              key={match.match_id}
              className={`${match.outcome} clickable-row`}
              onClick={() => onMatchClick && onMatchClick(match.match_id)}
              title="Click for match details"
            >
              <td>{new Date(match.date_time).toLocaleDateString()}</td>
              <td>
                <div className="map-info">
                  <strong>{match.map_name}</strong>
                  <span className="map-type">{match.map_type}</span>
                </div>
              </td>
              <td>
                <div className="hero-info">
                  <strong>{match.hero_played}</strong>
                  <span className={`role-badge role-${match.hero_role}`}>
                    {match.hero_role.toUpperCase()}
                  </span>
                </div>
              </td>
              <td className={`outcome-${match.outcome}`}>
                {match.outcome === 'win' ? '✓ WIN' : match.outcome === 'tie' ? '= TIE' : '✗ LOSS'}
              </td>
              <td>{match.final_score}</td>
              <td className="kda">
                {match.eliminations}/{match.assists}/{match.deaths}
              </td>
              <td>{match.damage_done.toLocaleString()}</td>
              <td>{match.healing_done > 0 ? match.healing_done.toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="see-more-wrapper">
          <button
            className="see-more-btn"
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
          >
            See More ({matches.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchHistory;
