import React, { useState, useEffect } from 'react';
import { getWinPercentageByMap, getWinPercentageByHero } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import MapDetailModal from './MapDetailModal';

const MapStats = ({ playerId }) => {
  const [mapStats, setMapStats] = useState([]);
  const [allHeroes, setAllHeroes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapTypeFilter, setMapTypeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [heroFilter, setHeroFilter] = useState('all');
  const [selectedMap, setSelectedMap] = useState(null);

  useEffect(() => {
    getWinPercentageByHero(playerId)
      .then(data => setAllHeroes(data.hero_stats.filter(h => h.total > 0)))
      .catch(err => console.error('Error fetching heroes:', err));
  }, [playerId]);

  useEffect(() => {
    fetchMapStats();
  }, [playerId, roleFilter, heroFilter]);

  const fetchMapStats = async () => {
    setLoading(true);
    try {
      const data = await getWinPercentageByMap(
        playerId,
        roleFilter === 'all' ? null : roleFilter,
        heroFilter === 'all' ? null : heroFilter
      );
      setMapStats(data.map_stats);
    } catch (err) {
      console.error('Error fetching map stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (e) => {
    setRoleFilter(e.target.value);
    setHeroFilter('all');
  };

  const heroOptions = roleFilter === 'all'
    ? allHeroes
    : allHeroes.filter(h => h.role === roleFilter);

  if (loading) return <div>Loading map stats...</div>;

  const filteredStats = mapTypeFilter === 'all'
    ? mapStats
    : mapStats.filter(m => m.map_type === mapTypeFilter);

  // Keep the backend sorting order (by map type, then alphabetically)
  const sortedStats = filteredStats;

  const WinRateTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="tooltip-title">{label}</p>
        <p className="tooltip-winrate">{d.total > 0 ? `${d.win_percentage}%` : '-%'}</p>
        <p className="tooltip-record">{d.wins}W – {d.losses}L – {d.draws}D</p>
      </div>
    );
  };

  // Color code bars: red for low win rate, green for high
  const getColor = (winRate) => {
    if (winRate >= 48 && winRate <= 52) return '#ffc400';
    return winRate > 52 ? '#44ff44' : '#ff4444';
  };

  return (
    <div className="map-stats">
      <h2>Map Performance Statistics</h2>

      {selectedMap && (
        <MapDetailModal
          map={selectedMap}
          playerId={playerId}
          onClose={() => setSelectedMap(null)}
        />
      )}

      <div className="controls">
        <label>Map Type: </label>
        <select value={mapTypeFilter} onChange={(e) => setMapTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="Control">Control</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Escort">Escort</option>
          <option value="Push">Push</option>
          <option value="Flashpoint">Flashpoint</option>
        </select>
        <label>Role: </label>
        <select value={roleFilter} onChange={handleRoleChange}>
          <option value="all">All Roles</option>
          <option value="tank">Tank</option>
          <option value="dps">DPS</option>
          <option value="support">Support</option>
        </select>
        <label>Hero: </label>
        <select value={heroFilter} onChange={(e) => setHeroFilter(e.target.value)}>
          <option value="all">All Heroes</option>
          {heroOptions.map(h => (
            <option key={h.hero_id} value={h.hero_id}>{h.hero_name}</option>
          ))}
        </select>
      </div>

      <div className="chart-section">
        <h3>Win Rate by Map</h3>
        <ResponsiveContainer width="100%" height={500}>
        <BarChart data={sortedStats} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="map_name"
            angle={-45}
            textAnchor="end"
            height={120}
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            width={65}
            label={{ value: 'Win %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip content={<WinRateTooltip />} />
          <Bar dataKey="win_percentage" name="Win %">
            {sortedStats.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.win_percentage)} />
            ))}
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 style={{ marginTop: '40px', marginBottom: '20px', textAlign: 'center', color: '#ff9c00' }}>
        Detailed Map Statistics
      </h3>
      <div className="stats-table-wrapper">
        <table className="stats-table">
        <thead>
          <tr>
            <th>Map</th>
            <th>Type</th>
            <th>Games</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Draws</th>
            <th>Win %</th>
          </tr>
        </thead>
        <tbody>
          {sortedStats.map((map) => (
            <tr
              key={map.map_id}
              className={`clickable-row${map.total > 0 && map.win_percentage < 45 ? ' weak-map' : ''}`}
              onClick={() => setSelectedMap(map)}
              title="Click for hero breakdown"
            >
              <td className="map-name">{map.map_name}</td>
              <td>{map.map_type}</td>
              <td>{map.total}</td>
              <td className="wins">{map.wins}</td>
              <td className="losses">{map.losses}</td>
              <td>{map.draws}</td>
              <td className="win-rate" style={{ color: map.total > 0 ? getColor(map.win_percentage) : 'var(--text-muted)' }}>
                {map.total > 0 ? `${map.win_percentage}%` : '-%'}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
};

export default MapStats;
