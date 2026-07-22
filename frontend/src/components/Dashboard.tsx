import React, { useState, useEffect } from 'react';
import { getPlayerStats, getPlayerMatchOutcomes } from '../api/client';
import type { PlayerStats, MatchOutcome, ModeFilter, SizeFilter } from '../types';
import HeroStats from './HeroStats';
import MapStats from './MapStats';
import TrendChart from './TrendChart';
import MatchHistory from './MatchHistory';
import MatchDetailModal from './MatchDetailModal';
import LogMatch from './LogMatch';

interface FilterGroupProps<T extends string> {
  className: string;
  ariaLabel: string;
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
}

function FilterGroup<T extends string>({ className, ariaLabel, options, value, onChange }: FilterGroupProps<T>) {
  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      {options.map(([optValue, label]) => (
        <button
          key={optValue}
          className={value === optValue ? 'active' : ''}
          aria-pressed={value === optValue}
          onClick={() => onChange(optValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const Dashboard = () => {
  const [inputValue, setInputValue] = useState<string>('');
  const [searchedTag, setSearchedTag] = useState<string>('');
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [loadedTag, setLoadedTag] = useState<string | null>(null);
  const [matchOutcomes, setMatchOutcomes] = useState<MatchOutcome[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'heroes' | 'maps' | 'trends'>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [showLogMatch, setShowLogMatch] = useState<boolean>(false);
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');

  useEffect(() => {
    if (searchedTag) {
      fetchPlayerData(searchedTag);
    } else {
      setPlayerStats(null);
      setNotFound(false);
      setLoading(false);
    }
  }, [searchedTag, modeFilter, sizeFilter]);

  const fetchPlayerData = async (tag: string) => {
    setLoading(true);
    setNotFound(false);
    try {
      const [stats, outcomes] = await Promise.all([
        getPlayerStats(tag, modeFilter, sizeFilter),
        getPlayerMatchOutcomes(tag, modeFilter, sizeFilter)
      ]);
      setPlayerStats(stats);
      setLoadedTag(tag);
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
    // Data on hand is only valid for the tag it was loaded for. On a tag change
    // it's stale (belongs to another player), so show the loader; on a same-tag
    // filter refetch we keep it visible and let it update in place (no flash).
    const hasCurrentPlayer = playerStats !== null && loadedTag === searchedTag;

    if (!searchedTag) {
      return (
        <div className="player-prompt">
          <p>Search for a battle tag to view player stats.</p>
        </div>
      );
    }

    if (loading && !hasCurrentPlayer) {
      return <div className="loading">Loading player data...</div>;
    }

    if (notFound) {
      return (
        <div className="player-not-found">
          <p>No player found for <strong>{searchedTag}</strong>.</p>
        </div>
      );
    }

    if (!hasCurrentPlayer) return null;

    return (
      <>
        <h2 className="player-heading">{searchedTag}</h2>
        <div className="filter-bar">
          <FilterGroup
            className="mode-filter"
            ariaLabel="Game mode filter"
            options={[['all', 'All'], ['ranked', 'Ranked'], ['unranked', 'Unranked']] as const}
            value={modeFilter}
            onChange={setModeFilter}
          />
          <FilterGroup
            className="size-filter"
            ariaLabel="Team size filter"
            options={[['all', 'All'], ['5v5', '5v5'], ['6v6', '6v6']] as const}
            value={sizeFilter}
            onChange={setSizeFilter}
          />
        </div>
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
            <HeroStats playerId={searchedTag} mode={modeFilter} size={sizeFilter} />
          )}
          {activeTab === 'maps' && (
            <MapStats playerId={searchedTag} mode={modeFilter} size={sizeFilter} />
          )}
          {activeTab === 'trends' && (
            <TrendChart playerId={searchedTag} mode={modeFilter} size={sizeFilter} />
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
      </header>

      {renderBody()}
    </div>
  );
};

export default Dashboard;
