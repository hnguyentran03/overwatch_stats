import React, { useState, useEffect } from 'react';
import { getPlayerStats, getPlayerMatchOutcomes } from '../api/client';
import HeroStats from './HeroStats';
import MapStats from './MapStats';
import TrendChart from './TrendChart';
import MatchHistory from './MatchHistory';

const Dashboard = () => {
  const [inputValue, setInputValue] = useState('PlayerOne#1234');
  const [searchedTag, setSearchedTag] = useState('PlayerOne#1234');
  const [playerStats, setPlayerStats] = useState(null);
  const [matchOutcomes, setMatchOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchPlayerData(searchedTag);
  }, [searchedTag]);

  const fetchPlayerData = async (tag) => {
    setLoading(true);
    setNotFound(false);
    setPlayerStats(null);
    try {
      const [stats, outcomes] = await Promise.all([
        getPlayerStats(tag),
        getPlayerMatchOutcomes(tag)
      ]);
      setPlayerStats(stats);
      setMatchOutcomes(outcomes.matches);
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true);
      }
      console.error('Error fetching player data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const trimmed = inputValue.trim();
    if (trimmed && trimmed !== searchedTag) {
      setSearchedTag(trimmed);
    } else if (trimmed === searchedTag) {
      fetchPlayerData(trimmed);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const renderBody = () => {
    if (loading) {
      return <div className="loading">Loading player data...</div>;
    }

    if (notFound) {
      return (
        <div className="player-not-found">
          <p>No player found for <strong>{searchedTag}</strong>.</p>
        </div>
      );
    }

    if (!playerStats) return null;

    return (
      <>
        <div className="stats-overview">
          <div className="stat-card">
            <h3>Total Matches</h3>
            <p className="stat-value">{playerStats.total_matches}</p>
          </div>
          <div className="stat-card">
            <h3>Overall Win Rate</h3>
            <p className="stat-value">{playerStats.win_percentage}%</p>
            <p className="stat-detail">{playerStats.wins}W – {playerStats.losses}L</p>
          </div>
          <div className="stat-card">
            <h3>Tank Win Rate</h3>
            <p className="stat-value">
              {playerStats.tank_win_percentage !== null ? `${playerStats.tank_win_percentage}%` : '—'}
            </p>
            <p className="stat-detail">
              {playerStats.tank_matches > 0 ? `${playerStats.tank_wins}W – ${playerStats.tank_losses}L` : 'No games'}
            </p>
          </div>
          <div className="stat-card">
            <h3>DPS Win Rate</h3>
            <p className="stat-value">
              {playerStats.dps_win_percentage !== null ? `${playerStats.dps_win_percentage}%` : '—'}
            </p>
            <p className="stat-detail">
              {playerStats.dps_matches > 0 ? `${playerStats.dps_wins}W – ${playerStats.dps_losses}L` : 'No games'}
            </p>
          </div>
          <div className="stat-card">
            <h3>Support Win Rate</h3>
            <p className="stat-value">
              {playerStats.support_win_percentage !== null ? `${playerStats.support_win_percentage}%` : '—'}
            </p>
            <p className="stat-detail">
              {playerStats.support_matches > 0 ? `${playerStats.support_wins}W – ${playerStats.support_losses}L` : 'No games'}
            </p>
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
            <HeroStats playerId={searchedTag} />
          )}
          {activeTab === 'maps' && (
            <MapStats playerId={searchedTag} />
          )}
          {activeTab === 'trends' && (
            <TrendChart playerId={searchedTag} />
          )}
        </div>
      </>
    );
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Overwatch Statistics</h1>
        <div className="player-selector">
          <label>Battle Tag: </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Name#1234"
          />
          <button className="search-btn" onClick={handleSearch}>Search</button>
        </div>
      </header>

      {renderBody()}
    </div>
  );
};

export default Dashboard;
