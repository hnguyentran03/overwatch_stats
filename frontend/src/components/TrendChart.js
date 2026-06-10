import React, { useState, useEffect } from 'react';
import { getMapTrends } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const GAME_MODE_ORDER = ['Control', 'Escort', 'Flashpoint', 'Hybrid', 'Push'];

const TrendChart = ({ playerId }) => {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState('week');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  useEffect(() => {
    fetchTrends();
  }, [playerId, timeWindow]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const data = await getMapTrends(playerId, timeWindow);
      setTrends(data.map_trends);
    } catch (err) {
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (mode) => {
    setCollapsedGroups(prev => ({ ...prev, [mode]: !prev[mode] }));
  };

  if (loading) return <div>Loading trends...</div>;

  // Prepare data for overall trend chart
  const overallTrendData = [];
  const periodMap = new Map();

  trends.forEach(mapTrend => {
    mapTrend.trends.forEach(period => {
      const key = period.period_start;
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          period: new Date(key).toLocaleDateString(),
          matches: 0,
          wins: 0,
          losses: 0
        });
      }
      const data = periodMap.get(key);
      data.matches += period.matches_played;
      data.wins += period.wins;
      data.losses += period.losses;
    });
  });

  periodMap.forEach((value) => {
    overallTrendData.push({
      ...value,
      win_percentage: value.matches > 0 ? ((value.wins / value.matches) * 100).toFixed(2) : 0
    });
  });

  overallTrendData.sort((a, b) => new Date(a.period) - new Date(b.period));

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

  const groupedTrends = GAME_MODE_ORDER.reduce((acc, mode) => {
    acc[mode] = trends.filter(t => t.map_type === mode);
    return acc;
  }, {});

  return (
    <div className="trend-chart">
      <h2>Performance Trends Over Time</h2>

      <div className="controls">
        <label>Time Window: </label>
        <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)}>
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      </div>

      <div className="chart-section">
        <h3>Overall Performance Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={overallTrendData} margin={{ top: 10, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              angle={-30}
              textAnchor="end"
              height={60}
            />
            <YAxis
              domain={[0, 100]}
              width={65}
              label={{ value: 'Win %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <Tooltip content={<WinRateTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="win_percentage" stroke="#ff9c00" name="Win %" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="map-trends-section">
        <h3>Individual Map Trends</h3>
        {GAME_MODE_ORDER.map((mode) => {
          const mapsInGroup = groupedTrends[mode] || [];
          const isCollapsed = collapsedGroups[mode] ?? false;

          return (
            <div key={mode} className="game-mode-group">
              <button
                className="game-mode-header"
                onClick={() => toggleGroup(mode)}
              >
                <span>{mode}</span>
                <span className="game-mode-count">{mapsInGroup.length} maps</span>
                <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
              </button>

              {!isCollapsed && (
                <div className="game-mode-maps">
                  {mapsInGroup.length === 0 ? (
                    <p className="no-data">No data for this game mode.</p>
                  ) : (
                    mapsInGroup.map((mapTrend) => {
                      const trendData = mapTrend.trends.map(t => ({
                        period: new Date(t.period_start).toLocaleDateString(),
                        win_percentage: t.win_percentage,
                        wins: t.wins,
                        losses: t.losses,
                      }));

                      return (
                        <div key={mapTrend.map_id} className="individual-map-trend">
                          <h4>{mapTrend.map_name}</h4>
                          {trendData.length === 0 ? (
                            <p className="no-data">No match data for this map.</p>
                          ) : (
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 20, bottom: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="period"
                                  angle={-30}
                                  textAnchor="end"
                                  height={55}
                                />
                                <YAxis
                                  domain={[0, 100]}
                                  width={55}
                                  label={{ value: 'Win %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                                />
                                <Tooltip content={<WinRateTooltip />} />
                                <Line type="monotone" dataKey="win_percentage" stroke="#ff9c00" strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrendChart;
