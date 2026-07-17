import React, { useState, useEffect } from 'react';
import { getWinPercentageByHero } from '../api/client';
import HeroStatsView from './HeroStatsView';
import type { HeroStat, MapStat, Role, ModeFilter } from '../types';

interface MapDetailModalProps {
  map: MapStat;
  playerId: string;
  onClose: () => void;
  roleFilter?: Role | 'all';
  mode?: ModeFilter;
}

const MapDetailModal = ({ map, playerId, onClose, roleFilter = 'all', mode = 'all' }: MapDetailModalProps) => {
  const [heroStats, setHeroStats] = useState<HeroStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getWinPercentageByHero(playerId, map.map_id, mode)
      .then(data => setHeroStats(data.hero_stats))
      .catch(() => setError('Failed to load hero stats for this map.'))
      .finally(() => setLoading(false));
  }, [playerId, map.map_id, mode]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const getWinRateColor = (pct: number) => {
    if (pct >= 48 && pct <= 52) return '#ffc400';
    return pct > 52 ? '#44ff44' : '#ff4444';
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content map-detail-modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <div className="modal-map">
            <span className="modal-map-name">{map.map_name}</span>
            <span className="map-type">{map.map_type}</span>
          </div>
          <div className="modal-meta">
            <span style={{ color: getWinRateColor(map.win_percentage), fontWeight: 'bold', fontSize: '1.1rem' }}>
              {map.win_percentage}% Win Rate
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {map.wins}W – {map.losses}L – {map.draws}D &nbsp;·&nbsp; {map.total} games
            </span>
          </div>
        </div>

        {loading && <div className="loading" style={{ marginTop: '2rem' }}>Loading hero stats...</div>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && (
          heroStats.length > 0
            ? <HeroStatsView heroes={heroStats} compact defaultRoleFilter={roleFilter} mapName={map.map_name} />
            : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                No hero data for this map.
              </div>
        )}
      </div>
    </div>
  );
};

export default MapDetailModal;
