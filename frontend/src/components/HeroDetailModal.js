import React, { useEffect } from 'react';

const Stat = ({ label, value }) => (
  <div className="hero-stat-item">
    <span className="hero-stat-label">{label}</span>
    <span className="hero-stat-value">{value}</span>
  </div>
);

const StatGroup = ({ title, children }) => (
  <div className="hero-stat-group">
    <h4 className="hero-stat-group-title">{title}</h4>
    <div className="hero-stat-grid">{children}</div>
  </div>
);

const HeroDetailModal = ({ hero, onClose }) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const fmt = (n) => Math.round(n).toLocaleString();
  const formatTime = (minutes) => {
    if (minutes < 100) return `${Math.round(minutes)} min`;
    const hrs = Math.round(minutes / 60);
    return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
  };
  const fmtDec = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content hero-detail-modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <div className="modal-map">
            <span className="modal-map-name">{hero.hero_name}</span>
            <span className="map-type">{hero.role.toUpperCase()}</span>
          </div>
          <div className={`modal-outcome outcome-${hero.win_percentage >= 50 ? 'win' : 'loss'}`}>
            {hero.win_percentage}% Win Rate
          </div>
        </div>

        <StatGroup title="Record">
          <Stat label="Games" value={hero.total} />
          <Stat label="Wins" value={hero.wins} />
          <Stat label="Losses" value={hero.losses} />
          <Stat label="Draws" value={hero.draws} />
          <Stat label="Time Played" value={formatTime(hero.total_time_played)} />
        </StatGroup>

        <StatGroup title="Totals">
          <Stat label="Eliminations" value={fmt(hero.total_eliminations)} />
          <Stat label="Final Blows" value={fmt(hero.total_final_blows)} />
          <Stat label="Assists" value={fmt(hero.total_assists)} />
          <Stat label="Deaths" value={fmt(hero.total_deaths)} />
          <Stat label="Damage" value={fmt(hero.total_damage_done)} />
          <Stat label="Healing" value={fmt(hero.total_healing_done)} />
          <Stat label="Mitigation" value={fmt(hero.total_damage_mitigated)} />
        </StatGroup>

        <StatGroup title="Per Game (Avg)">
          <Stat label="Eliminations" value={fmtDec(hero.avg_eliminations)} />
          <Stat label="Final Blows" value={fmtDec(hero.avg_final_blows)} />
          <Stat label="Assists" value={fmtDec(hero.avg_assists)} />
          <Stat label="Deaths" value={fmtDec(hero.avg_deaths)} />
          <Stat label="Damage" value={fmt(hero.avg_damage_done)} />
          <Stat label="Healing" value={fmt(hero.avg_healing_done)} />
          <Stat label="Mitigation" value={fmt(hero.avg_damage_mitigated)} />
        </StatGroup>

        <StatGroup title="Per 10 Minutes">
          <Stat label="Eliminations" value={fmtDec(hero.elims_per_10)} />
          <Stat label="Final Blows" value={fmtDec(hero.final_blows_per_10)} />
          <Stat label="Assists" value={fmtDec(hero.assists_per_10)} />
          <Stat label="Deaths" value={fmtDec(hero.deaths_per_10)} />
          <Stat label="Damage" value={fmt(hero.damage_per_10)} />
          <Stat label="Healing" value={fmt(hero.healing_per_10)} />
          <Stat label="Mitigation" value={fmt(hero.mitigation_per_10)} />
        </StatGroup>
      </div>
    </div>
  );
};

export default HeroDetailModal;
