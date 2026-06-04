import React, { useState, useEffect } from 'react';
import { getMapTrends } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TrendChart = ({ playerId }) => {
  const [trends, setTrends] = useState([]);
  const [weakestMaps, setWeakestMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState('week');

  useEffect(() => {
    fetchTrends();
  }, [playerId, timeWindow]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const data = await getMapTrends(playerId, timeWindow);
      setTrends(data.map_trends);
      setWeakestMaps(data.weakest_maps);
    } catch (err) {
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
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

  periodMap.forEach((value, key) => {
    overallTrendData.push({
      ...value,
      win_percentage: value.matches > 0 ? ((value.wins / value.matches) * 100).toFixed(2) : 0
    });
  });

  overallTrendData.sort((a, b) => new Date(a.period) - new Date(b.period));

  return (
    <div className="trend-chart">
      <div className="controls">
        <label>Time Window: </label>
        <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)}>
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      </div>

      <div className="weakest-maps-section">
        <h3>🎯 Focus Areas - Weakest Maps</h3>
        <div className="weakest-maps-grid">
          {weakestMaps.map((map, index) => (
            <div key={map.map_id} className="weak-map-card">
              <div className="rank">#{index + 1}</div>
              <h4>{map.map_name}</h4>
              <p className="map-type">{map.map_type}</p>
              <p className="win-rate">{map.win_percentage}% Win Rate</p>
              <p className="record">{map.wins}W - {map.losses}L ({map.total} games)</p>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-section">
        <h3>Overall Performance Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={overallTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="win_percentage" stroke="#ff9c00" name="Win %" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="map-trends-section">
        <h3>Individual Map Trends</h3>
        {trends.slice(0, 6).map((mapTrend) => {
          if (mapTrend.trends.length === 0) return null;

          const trendData = mapTrend.trends.map(t => ({
            period: new Date(t.period_start).toLocaleDateString(),
            win_percentage: t.win_percentage
          }));

          return (
            <div key={mapTrend.map_id} className="individual-map-trend">
              <h4>{mapTrend.map_name} ({mapTrend.map_type})</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="win_percentage" stroke="#ff9c00" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrendChart;
