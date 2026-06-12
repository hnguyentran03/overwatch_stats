import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import HeroDetailModal from './HeroDetailModal';

const COLUMNS = [
  { key: 'hero_name',              label: 'Hero',              numeric: false },
  { key: 'role',                   label: 'Role',              numeric: false },
  { key: 'total',                  label: 'Games',             numeric: true  },
  { key: 'wins',                   label: 'Wins',              numeric: true  },
  { key: 'losses',                 label: 'Losses',            numeric: true  },
  { key: 'win_percentage',         label: 'Win %',             numeric: true  },
  { key: 'total_time_played',      label: 'Time',              numeric: true  },
  { key: 'total_eliminations',     label: 'Total Elims',       numeric: true  },
  { key: 'total_final_blows',      label: 'Total Final Blows', numeric: true  },
  { key: 'total_deaths',           label: 'Total Deaths',      numeric: true  },
  { key: 'total_damage_done',      label: 'Total Damage',      numeric: true  },
  { key: 'total_healing_done',     label: 'Total Healing',     numeric: true  },
  { key: 'total_damage_mitigated', label: 'Total Mitigation',  numeric: true  },
];

const roleOrder = { tank: 0, dps: 1, support: 2 };

const HeroStatsView = ({ heroes, compact = false, defaultRoleFilter = 'all', mapName = null }) => {
  const [roleFilter, setRoleFilter] = useState(defaultRoleFilter);
  const [selectedHero, setSelectedHero] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortCol === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(key);
      setSortDir('desc');
    }
  };

  const filtered = (roleFilter === 'all' ? heroes : heroes.filter(h => h.role === roleFilter))
    .filter(h => h.total > 0);

  const sortedHeroes = sortCol
    ? [...filtered].sort((a, b) => {
        const col = COLUMNS.find(c => c.key === sortCol);
        let aVal = a[sortCol];
        let bVal = b[sortCol];
        if (sortCol === 'role') {
          aVal = roleOrder[aVal] ?? 99;
          bVal = roleOrder[bVal] ?? 99;
        }
        const cmp = col.numeric ? aVal - bVal : String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const formatTime = (minutes) => {
    if (minutes < 100) return `${Math.round(minutes)} min`;
    const hrs = Math.round(minutes / 60);
    return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
  };

  const getWinRateColor = (pct) => {
    if (pct >= 48 && pct <= 52) return '#ffc400';
    return pct > 52 ? '#44ff44' : '#ff4444';
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'tank': return '#2196F3';
      case 'dps': return '#ff9c00';
      case 'support': return '#4CAF50';
      default: return '#999999';
    }
  };

  const SortIcon = ({ colKey }) => {
    if (sortCol !== colKey) return <span className="sort-icon sort-icon-idle">⇅</span>;
    return <span className="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const WinRateTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="tooltip-title">{label}</p>
        <p className="tooltip-winrate">{d.win_percentage}%</p>
        <p className="tooltip-record">{d.wins}W – {d.losses}L – {d.draws}D</p>
      </div>
    );
  };

  return (
    <>
      {selectedHero && (
        <HeroDetailModal hero={selectedHero} mapName={mapName} onClose={() => setSelectedHero(null)} />
      )}

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
        <ResponsiveContainer width="100%" height={compact ? 260 : 500}>
          <BarChart data={sortedHeroes} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="hero_name"
              angle={-45}
              textAnchor="end"
              height={compact ? 90 : 110}
              interval={0}
              tick={compact ? { fontSize: 11 } : undefined}
            />
            <YAxis
              domain={[0, 100]}
              width={65}
              label={{ value: 'Win %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <Tooltip content={<WinRateTooltip />} />
            <Bar dataKey="win_percentage" name="Win %" cursor="pointer" onClick={(data) => setSelectedHero(data)}>
              {sortedHeroes.map((entry, index) => (
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
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="sortable-th"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label} <SortIcon colKey={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedHeroes.map((hero, i) => (
              <tr
                key={hero.hero_id ?? i}
                className="clickable-row"
                onClick={() => setSelectedHero(hero)}
                title="Click for full stats"
              >
                <td className="hero-name">{hero.hero_name}</td>
                <td className={`role-${hero.role}`}>{hero.role.toUpperCase()}</td>
                <td>{hero.total}</td>
                <td className="wins">{hero.wins}</td>
                <td className="losses">{hero.losses}</td>
                <td className="win-rate" style={{ color: getWinRateColor(hero.win_percentage) }}>{hero.win_percentage}%</td>
                <td>{formatTime(hero.total_time_played)}</td>
                <td>{hero.total_eliminations}</td>
                <td>{hero.total_final_blows}</td>
                <td>{hero.total_deaths}</td>
                <td>{Math.round(hero.total_damage_done).toLocaleString()}</td>
                <td>{Math.round(hero.total_healing_done).toLocaleString()}</td>
                <td>{Math.round(hero.total_damage_mitigated).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default HeroStatsView;
