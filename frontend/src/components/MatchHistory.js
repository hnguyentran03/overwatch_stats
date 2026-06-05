import React from 'react';

const MatchHistory = ({ matches }) => {
  if (!matches || matches.length === 0) {
    return <div>No match history available.</div>;
  }

  return (
    <div className="match-history">
      <h2>Match History</h2>
      <h3 style={{ textAlign: 'center', color: '#ff9c00', marginBottom: '20px' }}>
        Recent Matches (Last 20)
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
          {matches.slice(0, 20).map((match, index) => (
            <tr key={match.match_id} className={match.outcome}>
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
                {match.outcome === 'win' ? '✓ WIN' : '✗ LOSS'}
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
    </div>
  );
};

export default MatchHistory;
