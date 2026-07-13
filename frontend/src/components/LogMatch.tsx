import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getHeroes, getMaps, createMatch } from '../api/client';
import type { Hero, GameMap, Role, Team, CreateMatchPayload } from '../types';

interface HeroSlotForm {
  hero_name: string;
  time_played: string;
  eliminations: string;
  final_blows: string;
  assists: string;
  deaths: string;
  damage_done: string;
  healing_done: string;
  damage_mitigated: string;
}
interface PlayerForm {
  battle_tag: string;
  team: Team;
  heroes: HeroSlotForm[];
}
interface MatchForm {
  date_time: string;
  map_id: number | string;
  outcome: 'win' | 'loss' | 'draw';
  final_score: string;
  duration: string;
  players: PlayerForm[];
  bans: { team1: string[]; team2: string[] };
}
interface TeamComp { tank: number; dps: number; support: number; total: number; }
interface LogMatchProps {
  defaultBattleTag?: string;
  onSuccess: (matchId: number) => void;
  onCancel: () => void;
}

interface HeroSelectProps {
  value: string;
  onChange: (value: string) => void;
  availableRoles?: Role[] | null;
  requiredRole?: Role | null;
}

const EMPTY_HERO_SLOT: HeroSlotForm = {
  hero_name: '',
  time_played: '',
  eliminations: '',
  final_blows: '',
  assists: '',
  deaths: '',
  damage_done: '',
  healing_done: '',
  damage_mitigated: '',
};

const EMPTY_PLAYER: PlayerForm = {
  battle_tag: '',
  team: 'team1',
  heroes: [{ ...EMPTY_HERO_SLOT }],
};

const now = (): string => {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
};

const ROLE_LIMITS: Record<Role, number> = { tank: 1, dps: 2, support: 2 };
const ROLE_LABEL: Record<Role, string>  = { tank: 'T', dps: 'D', support: 'S' };
const MAX_BAN_TOTAL = 2;
const MAX_BAN_ROLE  = 2;

const LogMatch = ({ defaultBattleTag, onSuccess, onCancel }: LogMatchProps) => {
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBans, setShowBans] = useState(false);

  const [form, setForm] = useState<MatchForm>({
    date_time: now(),
    map_id: '',
    outcome: 'win',
    final_score: '',
    duration: '',
    players: [{ ...EMPTY_PLAYER, battle_tag: defaultBattleTag || '' }],
    bans: { team1: [], team2: [] },
  });

  useEffect(() => {
    Promise.all([getHeroes(), getMaps()])
      .then(([h, m]) => {
        setHeroes(h);
        setMaps(m);
        if (m.length > 0) setForm(f => ({ ...f, map_id: m[0].map_id }));
      })
      .catch(() => setError('Failed to load heroes/maps.'))
      .finally(() => setLoading(false));
  }, []);

  // ── lookups ──

  const heroRoleMap = useMemo(
    () => heroes.reduce((acc: Record<string, Role>, h) => { acc[h.hero_name] = h.role; return acc; }, {}),
    [heroes]
  );

  const herosByRole = useMemo(() =>
    heroes.reduce((acc: Record<string, Hero[]>, h) => {
      if (!acc[h.role]) acc[h.role] = [];
      acc[h.role].push(h);
      return acc;
    }, {}),
    [heroes]
  );

  const mapsByType = useMemo(() =>
    maps.reduce((acc: Record<string, GameMap[]>, m) => {
      if (!acc[m.map_type]) acc[m.map_type] = [];
      acc[m.map_type].push(m);
      return acc;
    }, {}),
    [maps]
  );

  // ── team composition ──

  // Count roles for a team, optionally excluding one player index
  const getTeamComp = (team: Team, excludeIdx = -1): TeamComp => {
    const counts: TeamComp = { tank: 0, dps: 0, support: 0, total: 0 };
    form.players.forEach((p, i) => {
      if (p.team !== team || i === excludeIdx) return;
      counts.total++;
      const role = heroRoleMap[p.heroes[0]?.hero_name];
      if (role) counts[role]++;
    });
    return counts;
  };

  // Roles still open on a team when excluding player pi
  const getAvailableRoles = (team: Team, pi: number): Role[] => {
    const comp = getTeamComp(team, pi);
    return (['tank', 'dps', 'support'] as Role[]).filter(role => comp[role] < ROLE_LIMITS[role]);
  };

  // Whether switching player pi to targetTeam is allowed
  const canSwitchToTeam = (pi: number, targetTeam: Team): boolean => {
    const player = form.players[pi];
    if (player.team === targetTeam) return true;
    const comp = getTeamComp(targetTeam);
    if (comp.total >= 5) return false;
    const primaryRole = heroRoleMap[player.heroes[0]?.hero_name];
    if (primaryRole && comp[primaryRole] >= ROLE_LIMITS[primaryRole]) return false;
    return true;
  };

  const getCompErrors = (team: Team): string[] => {
    const comp = getTeamComp(team);
    const label = team === 'team1' ? 'Team 1' : 'Team 2';
    const errs: string[] = [];
    if (comp.total > 5)     errs.push(`${label}: too many players (${comp.total}/5)`);
    if (comp.tank !== 1)    errs.push(`${label}: needs 1 Tank (has ${comp.tank})`);
    if (comp.dps !== 2)     errs.push(`${label}: needs 2 Damage (has ${comp.dps})`);
    if (comp.support !== 2) errs.push(`${label}: needs 2 Supports (has ${comp.support})`);
    return errs;
  };

  // ── ban helpers ──

  const getBanComp = (team: Team) => {
    const roleCounts: Record<Role, number> = { tank: 0, dps: 0, support: 0 };
    form.bans[team].forEach(name => {
      const role = heroRoleMap[name];
      if (role) roleCounts[role]++;
    });
    return { total: form.bans[team].length, ...roleCounts };
  };

  const isBanDisabled = (team: Team, heroName: string): boolean => {
    const selected = form.bans[team].includes(heroName);
    if (selected) return false;
    const banComp = getBanComp(team);
    if (banComp.total >= MAX_BAN_TOTAL) return true;
    const role = heroRoleMap[heroName];
    if (role && banComp[role] >= MAX_BAN_ROLE) return true;
    return false;
  };

  const allCompErrors = [...getCompErrors('team1'), ...getCompErrors('team2')];
  const canSubmit = allCompErrors.length === 0;

  // ── form helpers ──

  const setMatchField = <K extends keyof MatchForm>(field: K, value: MatchForm[K]) =>
    setForm(f => ({ ...f, [field]: value }));

  const setPlayerField = (pi: number, field: keyof PlayerForm, value: string | Team) =>
    setForm(f => ({
      ...f,
      players: f.players.map((p, i) => i === pi ? { ...p, [field]: value } : p),
    }));

  // Changing the PRIMARY hero: also wipe swap slots if the role changes
  const handlePrimaryHeroChange = (pi: number, newHeroName: string) => {
    setForm(f => {
      const player = f.players[pi];
      const oldRole = heroRoleMap[player.heroes[0]?.hero_name];
      const newRole = heroRoleMap[newHeroName];
      const roleChanged = newRole && oldRole !== newRole;
      return {
        ...f,
        players: f.players.map((p, i) => {
          if (i !== pi) return p;
          return {
            ...p,
            heroes: p.heroes.map((h, j) => {
              if (j === 0) return { ...h, hero_name: newHeroName };
              return roleChanged ? { ...EMPTY_HERO_SLOT } : h;
            }),
          };
        }),
      };
    });
  };

  const setHeroField = (pi: number, hi: number, field: keyof HeroSlotForm, value: string) =>
    setForm(f => ({
      ...f,
      players: f.players.map((p, i) => {
        if (i !== pi) return p;
        return { ...p, heroes: p.heroes.map((h, j) => j === hi ? { ...h, [field]: value } : h) };
      }),
    }));

  const addHeroSlot = (pi: number) =>
    setForm(f => ({
      ...f,
      players: f.players.map((p, i) =>
        i === pi ? { ...p, heroes: [...p.heroes, { ...EMPTY_HERO_SLOT }] } : p
      ),
    }));

  const removeHeroSlot = (pi: number, hi: number) =>
    setForm(f => ({
      ...f,
      players: f.players.map((p, i) =>
        i === pi ? { ...p, heroes: p.heroes.filter((_, j) => j !== hi) } : p
      ),
    }));

  const addPlayer = () =>
    setForm(f => ({
      ...f,
      players: [...f.players, { ...EMPTY_PLAYER, heroes: [{ ...EMPTY_HERO_SLOT }] }],
    }));

  const removePlayer = (pi: number) =>
    setForm(f => ({ ...f, players: f.players.filter((_, i) => i !== pi) }));

  const toggleBan = (team: Team, heroName: string) => {
    if (isBanDisabled(team, heroName)) return;
    setForm(f => {
      const current = f.bans[team];
      const updated = current.includes(heroName)
        ? current.filter(h => h !== heroName)
        : [...current, heroName];
      return { ...f, bans: { ...f.bans, [team]: updated } };
    });
  };

  // ── submit ──

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);

    const payload: CreateMatchPayload = {
      date_time: form.date_time,
      map_id: parseInt(String(form.map_id)),
      outcome: form.outcome,
      final_score: form.final_score.trim(),
      duration: form.duration !== '' ? parseFloat(form.duration) : 0,
      players: form.players
        .filter(p => p.battle_tag.trim())
        .map(p => ({
          battle_tag: p.battle_tag.trim(),
          team: p.team,
          heroes: p.heroes
            .filter(h => h.hero_name)
            .map(h => ({
              hero_name: h.hero_name,
              time_played: parseFloat(h.time_played) || 0,
              eliminations: parseInt(h.eliminations) || 0,
              final_blows: parseInt(h.final_blows) || 0,
              assists: parseInt(h.assists) || 0,
              deaths: parseInt(h.deaths) || 0,
              damage_done: parseFloat(h.damage_done) || 0,
              healing_done: parseFloat(h.healing_done) || 0,
              damage_mitigated: parseFloat(h.damage_mitigated) || 0,
            })),
        })),
      bans: form.bans,
    };

    try {
      const result = await createMatch(payload);
      onSuccess(result.match_id);
    } catch (err) {
      const message = axios.isAxiosError<{ error?: string }>(err) ? err.response?.data?.error : undefined;
      setError(message || 'Failed to save match.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── sub-components ──

  // availableRoles: only show these role groups (for primary hero)
  // requiredRole: only show this one role (for swap heroes)
  const HeroSelect = ({ value, onChange, availableRoles = null, requiredRole = null }: HeroSelectProps) => {
    const roles: Role[] = requiredRole
      ? [requiredRole]
      : (availableRoles || (['tank', 'dps', 'support'] as Role[]));

    if (roles.length === 0) {
      return (
        <div className="lm-input lm-no-roles">All roles filled on this team</div>
      );
    }

    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="lm-select" required>
        <option value="">Select hero</option>
        {roles.map(role =>
          herosByRole[role] ? (
            <optgroup key={role} label={role.toUpperCase()}>
              {herosByRole[role].map(h => (
                <option key={h.hero_id} value={h.hero_name}>{h.hero_name}</option>
              ))}
            </optgroup>
          ) : null
        )}
      </select>
    );
  };

  const TeamCompBadge = ({ team }: { team: Team }) => {
    const comp = getTeamComp(team);
    const errs = getCompErrors(team);
    return (
      <div className={`lm-comp-badge${errs.length ? ' lm-comp-error' : ''}`}>
        <span className="lm-comp-role lm-comp-tank">
          {ROLE_LABEL.tank} {comp.tank}/{ROLE_LIMITS.tank}
        </span>
        <span className="lm-comp-role lm-comp-dps">
          {ROLE_LABEL.dps} {comp.dps}/{ROLE_LIMITS.dps}
        </span>
        <span className="lm-comp-role lm-comp-support">
          {ROLE_LABEL.support} {comp.support}/{ROLE_LIMITS.support}
        </span>
        <span className="lm-comp-total">
          {comp.total}/5 players
        </span>
      </div>
    );
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="log-match">
      <div className="lm-header">
        <h2>Log Match</h2>
        <button className="lm-cancel-btn" onClick={onCancel} type="button">
          ← Back to Dashboard
        </button>
      </div>

      {error && <div className="lm-error">{error}</div>}

      {allCompErrors.length > 0 && (
        <div className="lm-validation-errors">
          {allCompErrors.map((e, i) => <div key={i} className="lm-validation-error">⚠ {e}</div>)}
        </div>
      )}

      <form onSubmit={handleSubmit} className="lm-form">

        {/* ── Match Info ── */}
        <section className="lm-section">
          <h3 className="lm-section-title">Match Info</h3>
          <div className="lm-grid">
            <div className="lm-field">
              <label>Date & Time</label>
              <input
                type="datetime-local"
                value={form.date_time}
                onChange={e => setMatchField('date_time', e.target.value)}
                className="lm-input"
                required
              />
            </div>

            <div className="lm-field">
              <label>Map</label>
              <select
                value={form.map_id}
                onChange={e => setMatchField('map_id', e.target.value)}
                className="lm-select"
                required
              >
                {Object.entries(mapsByType).map(([type, mapList]) => (
                  <optgroup key={type} label={type}>
                    {mapList.map(m => (
                      <option key={m.map_id} value={m.map_id}>{m.map_name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="lm-field">
              <label>Outcome</label>
              <div className="lm-outcome-btns">
                {(['win', 'loss', 'draw'] as const).map(o => (
                  <button
                    key={o}
                    type="button"
                    className={`lm-outcome-btn lm-outcome-${o}${form.outcome === o ? ' active' : ''}`}
                    onClick={() => setMatchField('outcome', o)}
                  >
                    {o.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="lm-field">
              <label>Final Score</label>
              <input
                type="text"
                value={form.final_score}
                onChange={e => setMatchField('final_score', e.target.value)}
                className="lm-input"
                placeholder="e.g. 3-2"
                required
              />
            </div>

            <div className="lm-field">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={form.duration}
                onChange={e => setMatchField('duration', e.target.value)}
                className="lm-input"
                placeholder="e.g. 22.5"
                min="0"
                step="0.1"
              />
            </div>
          </div>
        </section>

        {/* ── Players ── */}
        {form.players.map((player, pi) => {
          const compErrors = getCompErrors(player.team);
          const availableRoles = getAvailableRoles(player.team, pi);
          const primaryRole = heroRoleMap[player.heroes[0]?.hero_name] || null;
          const hasPrimaryHero = !!player.heroes[0]?.hero_name;

          return (
            <section key={pi} className={`lm-section lm-player-section${compErrors.length ? ' lm-section-invalid' : ''}`}>
              <div className="lm-player-header">
                <h3 className="lm-section-title">
                  {pi === 0 ? 'Your Stats' : `Player ${pi + 1}`}
                </h3>
                <TeamCompBadge team={player.team} />
                {pi > 0 && (
                  <button type="button" className="lm-remove-btn" onClick={() => removePlayer(pi)}>
                    Remove Player
                  </button>
                )}
              </div>

              <div className="lm-grid lm-player-meta">
                <div className="lm-field">
                  <label>Battle Tag</label>
                  <input
                    type="text"
                    value={player.battle_tag}
                    onChange={e => setPlayerField(pi, 'battle_tag', e.target.value)}
                    className="lm-input"
                    placeholder="Name#1234"
                    required
                  />
                </div>
                <div className="lm-field">
                  <label>Team Side</label>
                  <div className="lm-team-btns">
                    {(['team1', 'team2'] as const).map(t => {
                      const allowed = canSwitchToTeam(pi, t);
                      const active = player.team === t;
                      let title = '';
                      if (!allowed && !active) {
                        const comp = getTeamComp(t);
                        if (comp.total >= 5) title = `${t === 'team1' ? 'Team 1' : 'Team 2'} is full (5/5)`;
                        else title = `${primaryRole} slot is full on ${t === 'team1' ? 'Team 1' : 'Team 2'}`;
                      }
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`lm-team-btn lm-${t}${active ? ' active' : ''}${!allowed && !active ? ' disabled' : ''}`}
                          onClick={() => allowed && setPlayerField(pi, 'team', t)}
                          title={title}
                        >
                          {t === 'team1' ? 'Team 1' : 'Team 2'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Hero slots */}
              {player.heroes.map((heroSlot, hi) => (
                <div key={hi} className="lm-hero-slot">
                  <div className="lm-hero-slot-header">
                    <span className="lm-hero-slot-label">
                      {hi === 0 ? 'Hero Played' : `Hero Swap ${hi}`}
                    </span>
                    {hi > 0 && (
                      <button type="button" className="lm-remove-btn" onClick={() => removeHeroSlot(pi, hi)}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="lm-hero-row">
                    <div className="lm-field lm-field-hero">
                      <label>Hero</label>
                      {hi === 0 ? (
                        <HeroSelect
                          value={heroSlot.hero_name}
                          onChange={v => handlePrimaryHeroChange(pi, v)}
                          availableRoles={availableRoles}
                        />
                      ) : (
                        <HeroSelect
                          value={heroSlot.hero_name}
                          onChange={v => setHeroField(pi, hi, 'hero_name', v)}
                          requiredRole={primaryRole}
                        />
                      )}
                    </div>
                    <div className="lm-field">
                      <label>Time Played (min)</label>
                      <input type="number" value={heroSlot.time_played} min="0" step="0.1"
                        onChange={e => setHeroField(pi, hi, 'time_played', e.target.value)}
                        className="lm-input" placeholder="0" />
                    </div>
                    <div className="lm-field">
                      <label>Elims</label>
                      <input type="number" value={heroSlot.eliminations} min="0"
                        onChange={e => setHeroField(pi, hi, 'eliminations', e.target.value)}
                        className="lm-input" placeholder="0" />
                    </div>
                    <div className="lm-field">
                      <label>Final Blows</label>
                      <input type="number" value={heroSlot.final_blows} min="0"
                        onChange={e => setHeroField(pi, hi, 'final_blows', e.target.value)}
                        className="lm-input" placeholder="0" />
                    </div>
                    <div className="lm-field">
                      <label>Assists</label>
                      <input type="number" value={heroSlot.assists} min="0"
                        onChange={e => setHeroField(pi, hi, 'assists', e.target.value)}
                        className="lm-input" placeholder="0" />
                    </div>
                    <div className="lm-field">
                      <label>Deaths</label>
                      <input type="number" value={heroSlot.deaths} min="0"
                        onChange={e => setHeroField(pi, hi, 'deaths', e.target.value)}
                        className="lm-input" placeholder="0" />
                    </div>
                    <div className="lm-field">
                      <label>Damage Done</label>
                      <input type="number" value={heroSlot.damage_done} min="0" step="1"
                        onChange={e => setHeroField(pi, hi, 'damage_done', e.target.value)}
                        className="lm-input" placeholder="0" />
                    </div>
                    <div className="lm-field">
                      <label>Healing Done</label>
                      <input type="number" value={heroSlot.healing_done} min="0" step="1"
                        onChange={e => setHeroField(pi, hi, 'healing_done', e.target.value)}
                        className="lm-input" placeholder="0" />
                    </div>
                    <div className="lm-field">
                      <label>Dmg Mitigated</label>
                      <input type="number" value={heroSlot.damage_mitigated} min="0" step="1"
                        onChange={e => setHeroField(pi, hi, 'damage_mitigated', e.target.value)}
                        className="lm-input" placeholder="0" />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="lm-add-hero-btn"
                onClick={() => addHeroSlot(pi)}
                disabled={!hasPrimaryHero}
                title={!hasPrimaryHero ? 'Select a primary hero first' : ''}
              >
                + Add Hero Swap
              </button>
            </section>
          );
        })}

        <button type="button" className="lm-add-player-btn" onClick={addPlayer}>
          + Add Another Player
        </button>

        {/* ── Bans ── */}
        <section className="lm-section">
          <button
            type="button"
            className="lm-bans-toggle"
            onClick={() => setShowBans(s => !s)}
          >
            Hero Bans (optional) {showBans ? '▲' : '▼'}
          </button>

          {showBans && (
            <div className="lm-bans">
              {(['team1', 'team2'] as const).map(team => {
                const banComp = getBanComp(team);
                const atMax = banComp.total >= MAX_BAN_TOTAL;
                return (
                  <div key={team} className="lm-bans-team">
                    <h4 className={`lm-bans-team-title lm-${team}`}>
                      {team === 'team1' ? 'Team 1' : 'Team 2'} Bans
                      <span className={`lm-ban-count${atMax ? ' lm-ban-count-full' : ''}`}>
                        {banComp.total}/{MAX_BAN_TOTAL}
                      </span>
                    </h4>
                    {(['tank', 'dps', 'support'] as const).map(role => (
                      <div key={role} className="lm-bans-role-group">
                        <span className={`lm-bans-role-label lm-role-${role}`}>{role.toUpperCase()}</span>
                        <div className="lm-bans-grid">
                          {(herosByRole[role] || []).map(h => {
                            const selected = form.bans[team].includes(h.hero_name);
                            const disabled = isBanDisabled(team, h.hero_name);
                            return (
                              <button
                                key={h.hero_id}
                                type="button"
                                className={`lm-ban-chip lm-role-${h.role}${selected ? ' selected' : ''}${disabled ? ' ban-disabled' : ''}`}
                                onClick={() => toggleBan(team, h.hero_name)}
                                disabled={disabled}
                                title={disabled ? (atMax && !selected ? 'Ban limit reached (2/2)' : `${h.role} ban limit reached`) : ''}
                              >
                                {h.hero_name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Submit ── */}
        <div className="lm-submit-row">
          <button type="button" className="lm-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="lm-submit-btn"
            disabled={submitting || !canSubmit}
            title={!canSubmit ? 'Fix team composition errors before saving' : ''}
          >
            {submitting ? 'Saving...' : 'Save Match'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LogMatch;
