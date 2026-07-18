import React, { useState, useEffect } from 'react';
import { getMapTrends } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import MapDetailModal from './MapDetailModal';
import type { MapStat, MapTrend, Role, TrendPeriod, ModeFilter, SizeFilter } from '../types';

interface TrendChartProps { playerId: string; mode: ModeFilter; size: SizeFilter; }
interface CumulativePoint { period: string; wins: number; losses: number; win_percentage: string | number; }
interface TooltipProps { active?: boolean; payload?: Array<{ payload: CumulativePoint }>; label?: string; }

const GAME_MODE_ORDER = ['Control', 'Escort', 'Flashpoint', 'Hybrid', 'Push'];

const TrendChart = ({ playerId, mode, size }: TrendChartProps) => {
  const [trends, setTrends] = useState<MapTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<'day' | 'week' | 'month'>('week');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [selectedMap, setSelectedMap] = useState<MapStat | null>(null);

  useEffect(() => {
    fetchTrends();
  }, [playerId, timeWindow, roleFilter, mode, size]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const data = await getMapTrends(playerId, timeWindow, roleFilter === 'all' ? null : roleFilter, mode, size);
      setTrends(data.map_trends);
    } catch (err) {
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (mode: string) => {
    setCollapsedGroups(prev => ({ ...prev, [mode]: !prev[mode] }));
  };

  const buildMapStats = (mapTrend: MapTrend): MapStat => {
    const wins = mapTrend.trends.reduce((s, t) => s + t.wins, 0);
    const losses = mapTrend.trends.reduce((s, t) => s + t.losses, 0);
    // Backend trend periods never actually include `draws` (see calculate_map_trends),
    // so TrendPeriod has no `draws` field. Cast preserves the original defensive
    // `t.draws || 0` fallback (always 0 today) without a real `any`.
    const draws = mapTrend.trends.reduce((s, t) => s + ((t as TrendPeriod & { draws?: number }).draws || 0), 0);
    const total = wins + losses + draws;
    return {
      map_id: mapTrend.map_id,
      map_name: mapTrend.map_name,
      map_type: mapTrend.map_type,
      wins,
      losses,
      draws,
      total,
      win_percentage: total > 0 ? Number(((wins / total) * 100).toFixed(2)) : 0,
    };
  };

  if (loading) return <div>Loading trends...</div>;

  // Prepare data for overall trend chart (cumulative win %)
  const periodMap = new Map<string, { wins: number; losses: number }>();

  trends.forEach(mapTrend => {
    mapTrend.trends.forEach(period => {
      const key = period.period_start;
      let data = periodMap.get(key);
      if (!data) { data = { wins: 0, losses: 0 }; periodMap.set(key, data); }
      data.wins += period.wins;
      data.losses += period.losses;
    });
  });

  let cumWins = 0, cumLosses = 0;
  const overallTrendData = [...periodMap.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([key, value]) => {
      cumWins += value.wins;
      cumLosses += value.losses;
      const total = cumWins + cumLosses;
      return {
        period: new Date(key).toLocaleDateString(),
        wins: cumWins,
        losses: cumLosses,
        win_percentage: total > 0 ? ((cumWins / total) * 100).toFixed(2) : 0,
      };
    });

  const WinRateTooltip = ({ active, payload, label }: TooltipProps) => {
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

  const groupedTrends = GAME_MODE_ORDER.reduce((acc: Record<string, MapTrend[]>, mode) => {
    acc[mode] = trends.filter(t => t.map_type === mode);
    return acc;
  }, {});

  return (
    <div className="trend-chart">
      {selectedMap && (
        <MapDetailModal
          map={selectedMap}
          playerId={playerId}
          onClose={() => setSelectedMap(null)}
          roleFilter={roleFilter}
          mode={mode}
          size={size}
        />
      )}
      <h2>Performance Trends Over Time</h2>

      <div className="controls">
        <label>Time Window: </label>
        <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value as 'day' | 'week' | 'month')}>
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
        <label>Role: </label>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}>
          <option value="all">All Roles</option>
          <option value="tank">Tank</option>
          <option value="dps">DPS</option>
          <option value="support">Support</option>
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
                      let mCumWins = 0, mCumLosses = 0;
                      const trendData = [...mapTrend.trends]
                        .sort((a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime())
                        .map(t => {
                          mCumWins += t.wins;
                          mCumLosses += t.losses;
                          const total = mCumWins + mCumLosses;
                          return {
                            period: new Date(t.period_start).toLocaleDateString(),
                            win_percentage: total > 0 ? ((mCumWins / total) * 100).toFixed(2) : 0,
                            wins: mCumWins,
                            losses: mCumLosses,
                          };
                        });

                      return (
                        <div key={mapTrend.map_id} className="individual-map-trend">
                          <h4
                            className="clickable-map-heading"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedMap(buildMapStats(mapTrend))}
                            title="Click for detailed stats"
                          >{mapTrend.map_name}</h4>
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
