import React, { useState, useEffect } from 'react';
import { getWinPercentageByHero } from '../api/client';
import HeroStatsView from './HeroStatsView';
import type { HeroStat, ModeFilter, SizeFilter } from '../types';

interface HeroStatsProps { playerId: string; mode: ModeFilter; size: SizeFilter; }

const HeroStats = ({ playerId, mode, size }: HeroStatsProps) => {
  const [heroStats, setHeroStats] = useState<HeroStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getWinPercentageByHero(playerId, null, mode, size)
      .then(data => setHeroStats(data.hero_stats))
      .catch(err => console.error('Error fetching hero stats:', err))
      .finally(() => setLoading(false));
  }, [playerId, mode, size]);

  if (loading) return <div>Loading hero stats...</div>;

  return (
    <div className="hero-stats">
      <h2>Hero Performance Statistics</h2>
      <HeroStatsView heroes={heroStats} />
    </div>
  );
};

export default HeroStats;
