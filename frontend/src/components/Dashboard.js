import React, { useState, useEffect } from 'react';
import { getPlayerStats, getPlayerMatchOutcomes } from '../api/client';
import HeroStats from './HeroStats';
import MapStats from './MapStats';
import TrendChart from './TrendChart';
import MatchHistory from './MatchHistory';

const Dashboard = () => {
  const [playerId, setPlayerId] = useState(1);
  const [playerStats, setPlayerStats] = useState(null);
  const [matchOutcomes, setMatchOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchPlayerData();
  }, [playerId]);

  const fetchPlayerData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stats, outcomes] = await Promise.all([
        getPlayerStats(playerId),
        getPlayerMatchOutcomes(playerId)
      ]);
      setPlayerStats(stats);
      setMatchOutcomes(outcomes.matches);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching player data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading player data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!playerStats) {
    return <div className="error">No player data found</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Overwatch Statistics</h1>
        <div className="player-selector">
          <label>Player ID: </label>
          <input
            type="number"
            value={playerId}
            onChange={(e) => setPlayerId(parseInt(e.target.value))}
            min="1"
          />
        </div>
      </header>

      <div className="stats-overview">
        <div className="stat-card">
          <h3>Total Matches</h3>
          <p className="stat-value">{playerStats.total_matches}</p>
        </div>
        <div className="stat-card">
          <h3>Win Rate</h3>
          <p className="stat-value">{playerStats.win_percentage}%</p>
          <p className="stat-detail">{playerStats.wins}W - {playerStats.losses}L</p>
        </div>
        <div className="stat-card">
          <h3>Avg Eliminations</h3>
          <p className="stat-value">{playerStats.avg_eliminations}</p>
        </div>
        <div className="stat-card">
          <h3>Avg Deaths</h3>
          <p className="stat-value">{playerStats.avg_deaths}</p>
        </div>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={activeTab === 'heroes' ? 'active' : ''}
          onClick={() => setActiveTab('heroes')}
        >
          Hero Stats
        </button>
        <button
          className={activeTab === 'maps' ? 'active' : ''}
          onClick={() => setActiveTab('maps')}
        >
          Map Stats
        </button>
        <button
          className={activeTab === 'trends' ? 'active' : ''}
          onClick={() => setActiveTab('trends')}
        >
          Trends
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <MatchHistory matches={matchOutcomes} />
        )}
        {activeTab === 'heroes' && (
          <HeroStats playerId={playerId} />
        )}
        {activeTab === 'maps' && (
          <MapStats playerId={playerId} />
        )}
        {activeTab === 'trends' && (
          <TrendChart playerId={playerId} />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
