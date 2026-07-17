import React, { useState, useEffect } from 'react';
import { getPlayerStats, getPlayerMatchOutcomes } from '../api/client';
import type { PlayerStats, MatchOutcome, ModeFilter } from '../types';
import HeroStats from './HeroStats';
import MapStats from './MapStats';
import TrendChart from './TrendChart';
import MatchHistory from './MatchHistory';
import MatchDetailModal from './MatchDetailModal';
import LogMatch from './LogMatch';

const Dashboard = () => {
  const [inputValue, setInputValue] = useState<string>('PlayerOne#1234');
  const [searchedTag, setSearchedTag] = useState<string>('PlayerOne#1234');
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [matchOutcomes, setMatchOutcomes] = useState<MatchOutcome[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'heroes' | 'maps' | 'trends'>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [showLogMatch, setShowLogMatch] = useState<boolean>(false);
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  useEffect(() => {
    fetchPlayerData(searchedTag);
  }, [searchedTag, modeFilter]);

  const fetchPlayerData = async (tag: string) => {
    setLoading(true);
    setNotFound(false);
    setPlayerStats(null);
    try {
      const [stats, outcomes] = await Promise.all([
        getPlayerStats(tag, modeFilter),
        getPlayerMatchOutcomes(tag, modeFilter)
      ]);
      setPlayerStats(stats);
      setMatchOutcomes(outcomes.matches);
    } catch (err: any) {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        <h2 className="player-heading">{searchedTag}</h2>
        <div className="stats-overview">
          <div className="stat-card">
            <h3>Total Matches</h3>
            <p className="stat-value">{playerStats.total_matches}</p>
          </div>
          <div className="stat-card">
            <h3>Overall Win Rate</h3>
            <p className="stat-value">{playerStats.win_percentage}%</p>
            <p className="stat-detail">{playerStats.wins}W – {playerStats.losses}L – {playerStats.draws}D</p>
          </div>
          <div className="stat-card">
            <h3>Tank Win Rate</h3>
            <p className="stat-value">
              {playerStats.tank_win_percentage !== null ? `${playerStats.tank_win_percentage}%` : '—'}
            </p>
            <p className="stat-detail">
              {playerStats.tank_matches > 0 ? `${playerStats.tank_wins}W – ${playerStats.tank_losses}L – ${playerStats.tank_draws}D` : 'No games'}
            </p>
          </div>
          <div className="stat-card">
            <h3>DPS Win Rate</h3>
            <p className="stat-value">
              {playerStats.dps_win_percentage !== null ? `${playerStats.dps_win_percentage}%` : '—'}
            </p>
            <p className="stat-detail">
              {playerStats.dps_matches > 0 ? `${playerStats.dps_wins}W – ${playerStats.dps_losses}L – ${playerStats.dps_draws}D` : 'No games'}
            </p>
          </div>
          <div className="stat-card">
            <h3>Support Win Rate</h3>
            <p className="stat-value">
              {playerStats.support_win_percentage !== null ? `${playerStats.support_win_percentage}%` : '—'}
            </p>
            <p className="stat-detail">
              {playerStats.support_matches > 0 ? `${playerStats.support_wins}W – ${playerStats.support_losses}L – ${playerStats.support_draws}D` : 'No games'}
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
            <MatchHistory matches={matchOutcomes} onMatchClick={setSelectedMatchId} />
          )}
          {activeTab === 'heroes' && (
            <HeroStats playerId={searchedTag} mode={modeFilter} />
          )}
          {activeTab === 'maps' && (
            <MapStats playerId={searchedTag} mode={modeFilter} />
          )}
          {activeTab === 'trends' && (
            <TrendChart playerId={searchedTag} mode={modeFilter} />
          )}
        </div>
      </>
    );
  };

  if (showLogMatch) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <h1>Overwatch Statistics</h1>
        </header>
        <LogMatch
          onCancel={() => setShowLogMatch(false)}
          onSuccess={(matchId: number) => {
            setShowLogMatch(false);
            fetchPlayerData(searchedTag);
          }}
        />
      </div>
    );
  }

  return (
    <div className="dashboard">
      {selectedMatchId && (
        <MatchDetailModal
          matchId={selectedMatchId}
          battleTag={searchedTag}
          onClose={() => setSelectedMatchId(null)}
        />
      )}
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
          <button className="log-match-btn" onClick={() => setShowLogMatch(true)}>
            + Log Match
          </button>
        </div>
        <div className="mode-filter" role="group" aria-label="Game mode filter">
          {([['all', 'All'], ['ranked', 'Ranked'], ['unranked', 'Unranked']] as const).map(([value, label]) => (
            <button
              key={value}
              className={modeFilter === value ? 'active' : ''}
              onClick={() => setModeFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {renderBody()}
    </div>
  );
};

export default Dashboard;
