import React, { useState, useEffect } from 'react';
import { getWinPercentageByHero } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const HeroStats = ({ playerId }) => {
  const [heroStats, setHeroStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchHeroStats();
  }, [playerId]);

  const fetchHeroStats = async () => {
    setLoading(true);
    try {
      const data = await getWinPercentageByHero(playerId);
      setHeroStats(data.hero_stats);
    } catch (err) {
      console.error('Error fetching hero stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading hero stats...</div>;

  const filteredStats = roleFilter === 'all'
    ? heroStats
    : heroStats.filter(h => h.role === roleFilter);

  const WinRateTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="tooltip-title">{label}</p>
        <p className="tooltip-winrate">{d.win_percentage}%</p>
        <p className="tooltip-record">{d.wins}W – {d.losses}L</p>
      </div>
    );
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'tank': return '#2196F3';
      case 'dps': return '#ff9c00';
      case 'support': return '#4CAF50';
      default: return '#999999';
    }
  };

  return (
    <div className="hero-stats">
      <h2>Hero Performance Statistics</h2>

      <div className="controls">
        <label>Filter by Role: </label>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="tank">Tank</option>
          <option value="dps">DPS</option>
          <option value="support">Support</option>
        </select>
      </div>

      <div className="chart-section">
        <h3>Win Rate by Hero</h3>
        <ResponsiveContainer width="100%" height={500}>
        <BarChart data={filteredStats} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="hero_name"
            angle={-45}
            textAnchor="end"
            height={110}
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            width={65}
            label={{ value: 'Win %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip content={<WinRateTooltip />} />
          <Bar dataKey="win_percentage" name="Win %">
            {filteredStats.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getRoleColor(entry.role)} />
            ))}
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 style={{ marginTop: '40px', marginBottom: '20px', textAlign: 'center', color: '#ff9c00' }}>
        Detailed Hero Statistics
      </h3>
      <div className="stats-table-wrapper">
        <table className="stats-table">
        <thead>
          <tr>
            <th>Hero</th>
            <th>Role</th>
            <th>Games</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Win %</th>
            <th>Time (min)</th>
            <th>Avg Elims</th>
            <th>Avg Final Blows</th>
            <th>Avg Deaths</th>
            <th>Avg Damage</th>
            <th>Avg Healing</th>
            <th>Avg Mitigation</th>
            <th>Elims/10</th>
            <th>Final Blows/10</th>
            <th>Deaths/10</th>
            <th>Damage/10</th>
            <th>Healing/10</th>
            <th>Mitigation/10</th>
          </tr>
        </thead>
        <tbody>
          {filteredStats.map((hero) => (
            <tr key={hero.hero_id}>
              <td className="hero-name">{hero.hero_name}</td>
              <td className={`role-${hero.role}`}>{hero.role.toUpperCase()}</td>
              <td>{hero.total}</td>
              <td className="wins">{hero.wins}</td>
              <td className="losses">{hero.losses}</td>
              <td className="win-rate">{hero.win_percentage}%</td>
              <td>{hero.total_time_played?.toFixed(1) || 0}</td>
              <td>{hero.avg_eliminations}</td>
              <td>{hero.avg_final_blows}</td>
              <td>{hero.avg_deaths}</td>
              <td>{hero.avg_damage_done?.toLocaleString() || 0}</td>
              <td>{hero.avg_healing_done?.toLocaleString() || 0}</td>
              <td>{hero.avg_damage_mitigated?.toLocaleString() || 0}</td>
              <td>{hero.elims_per_10}</td>
              <td>{hero.final_blows_per_10}</td>
              <td>{hero.deaths_per_10}</td>
              <td>{hero.damage_per_10?.toLocaleString() || 0}</td>
              <td>{hero.healing_per_10?.toLocaleString() || 0}</td>
              <td>{hero.mitigation_per_10?.toLocaleString() || 0}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
};

export default HeroStats;
