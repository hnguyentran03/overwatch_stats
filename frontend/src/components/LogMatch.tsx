import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getHeroes, getMaps, createMatch, parseScoreboard } from '../api/client';
import type { Hero, GameMap, Role, Team, CreateMatchPayload, GameMode, TeamSize } from '../types';

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
  game_mode: GameMode;
  team_size: TeamSize;
  final_score: string;
  duration: string;
  players: PlayerForm[];
  bans: { team1: string[]; team2: string[] };
}
interface TeamComp { tank: number; dps: number; support: number; total: number; }
interface LogMatchProps {
  onSuccess: (matchId: number) => void;
  onCancel: () => void;
}

interface HeroSelectProps {
  value: string;
  onChange: (value: string) => void;
  heroRoleMap: Record<string, Role>;
  herosByRole: Record<string, Hero[]>;
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

interface SizeRules {
  totalPlayers: number;
  roleMax: Record<Role, number>;          // hard cap per role (used for dropdown gating + >max errors)
  roleExact: Partial<Record<Role, number>>; // roles that must equal an exact count
}
const SIZE_RULES: Record<TeamSize, SizeRules> = {
  '5v5': { totalPlayers: 5, roleMax: { tank: 1, dps: 2, support: 2 }, roleExact: { tank: 1, dps: 2, support: 2 } },
  '6v6': { totalPlayers: 6, roleMax: { tank: 2, dps: 6, support: 6 }, roleExact: {} },
};
const ROLE_LABEL: Record<Role, string>  = { tank: 'T', dps: 'D', support: 'S' };
const MAX_BAN_TOTAL = 2;
const MAX_BAN_ROLE  = 2;

// requiredRole: only show this one role (for swap heroes)
const HeroSelect = ({ value, onChange, heroRoleMap, herosByRole, availableRoles = null, requiredRole = null }: HeroSelectProps) => {
  const baseRoles: Role[] = requiredRole
    ? [requiredRole]
    : (availableRoles || (['tank', 'dps', 'support'] as Role[]));
  // Always include the currently-selected hero's role, so an autofilled or
  // already-chosen hero never renders as blank when its role slot reads as
  // "full" (e.g. after a scoreboard autofill fills every role).
  const valueRole = heroRoleMap[value];
  const roles: Role[] = valueRole && !baseRoles.includes(valueRole)
    ? [...baseRoles, valueRole]
    : baseRoles;

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

const LogMatch = ({ onSuccess, onCancel }: LogMatchProps) => {
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBans, setShowBans] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [autofilledRows, setAutofilledRows] = useState<Set<number>>(() => new Set());

  const [form, setForm] = useState<MatchForm>({
    date_time: now(),
    map_id: '',
    outcome: 'win',
    game_mode: 'ranked',
    team_size: '5v5',
    final_score: '',
    duration: '',
    players: [{ ...EMPTY_PLAYER }],
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

  const rules = SIZE_RULES[form.team_size];

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
    if (comp.total >= rules.totalPlayers) return [];
    return (['tank', 'dps', 'support'] as Role[]).filter(role => comp[role] < rules.roleMax[role]);
  };

  // Whether switching player pi to targetTeam is allowed
  const canSwitchToTeam = (pi: number, targetTeam: Team): boolean => {
    const player = form.players[pi];
    if (player.team === targetTeam) return true;
    const comp = getTeamComp(targetTeam);
    if (comp.total >= rules.totalPlayers) return false;
    const primaryRole = heroRoleMap[player.heroes[0]?.hero_name];
    if (primaryRole && comp[primaryRole] >= rules.roleMax[primaryRole]) return false;
    return true;
  };

  const ROLE_NAME: Record<Role, string> = { tank: 'Tank', dps: 'Damage', support: 'Support' };
  // 'Damage' never pluralizes; Tank/Support get an 's' above 1 — this exactly
  // reproduces today's messages ("needs 1 Tank", "needs 2 Damage", "needs 2 Supports"),
  // which existing tests assert on.
  const roleLabel = (role: Role, n: number): string =>
    role === 'dps' || n === 1 ? ROLE_NAME[role] : `${ROLE_NAME[role]}s`;
  const getCompErrors = (team: Team): string[] => {
    const comp = getTeamComp(team);
    const label = team === 'team1' ? 'Team 1' : 'Team 2';
    const errs: string[] = [];
    if (comp.total !== rules.totalPlayers) {
      errs.push(`${label}: needs ${rules.totalPlayers} players (has ${comp.total})`);
    }
    (['tank', 'dps', 'support'] as Role[]).forEach(role => {
      const exact = rules.roleExact[role];
      if (exact !== undefined && comp[role] !== exact) {
        errs.push(`${label}: needs ${exact} ${roleLabel(role, exact)} (has ${comp[role]})`);
      } else if (exact === undefined && comp[role] > rules.roleMax[role]) {
        errs.push(`${label}: at most ${rules.roleMax[role]} ${roleLabel(role, rules.roleMax[role])} (has ${comp[role]})`);
      }
    });
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

  // ── autofill review state ──
  const didAutofill = autofilledRows.size > 0;
  // True for a primary hero slot that the autofill left empty (hero not recognized).
  const heroNeedsPick = (pi: number, hi: number, heroSlot: HeroSlotForm): boolean =>
    hi === 0 && autofilledRows.has(pi) && !heroSlot.hero_name;
  const autofillMissingHeroes = form.players.filter(
    (p, i) => autofilledRows.has(i) && !p.heroes[0]?.hero_name
  ).length;

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

  // ── scoreboard autofill ──

  const handleScoreboardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';            // allow re-uploading the same file
    if (!file) return;

    setError(null);
    setParsing(true);
    try {
      const parsed = await parseScoreboard(file);
      const players: PlayerForm[] = parsed.map((p) => ({
        battle_tag: p.battle_tag,
        team: p.team === 'team2' ? 'team2' : 'team1',
        heroes: [{
          ...EMPTY_HERO_SLOT,
          hero_name: heroRoleMap[p.hero_name] ? p.hero_name : '',
          eliminations: String(p.eliminations ?? ''),
          assists: String(p.assists ?? ''),
          deaths: String(p.deaths ?? ''),
          damage_done: String(p.damage_done ?? ''),
          healing_done: String(p.healing_done ?? ''),
          damage_mitigated: String(p.damage_mitigated ?? ''),
        }],
      }));
      setForm((f) => ({ ...f, players }));
      setAutofilledRows(new Set(players.map((_, i) => i)));
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Could not read that scoreboard. Try another screenshot or enter stats manually.'
      );
    } finally {
      setParsing(false);
    }
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
      game_mode: form.game_mode,
      team_size: form.team_size,
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

  const TeamCompBadge = ({ team }: { team: Team }) => {
    const comp = getTeamComp(team);
    const errs = getCompErrors(team);
    return (
      <div className={`lm-comp-badge${errs.length ? ' lm-comp-error' : ''}`}>
        {(['tank', 'dps', 'support'] as Role[]).map(role => {
          const capped = rules.roleExact[role] !== undefined || rules.roleMax[role] < rules.totalPlayers;
          return (
            <span key={role} className={`lm-comp-role lm-comp-${role}`}>
              {ROLE_LABEL[role]} {comp[role]}{capped ? `/${rules.roleMax[role]}` : ''}
            </span>
          );
        })}
        <span className="lm-comp-total">
          {comp.total}/{rules.totalPlayers} players
        </span>
      </div>
    );
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="log-match">
      {parsing && (
        <div className="modal-backdrop lm-parsing-backdrop" role="dialog" aria-modal="true" aria-label="Reading scoreboard">
          <div className="modal-content lm-parsing-modal">
            <div className="lm-parsing-spinner" />
            <p className="lm-parsing-text">Reading scoreboard…</p>
            <p className="lm-parsing-sub">This can take a few seconds. Please wait.</p>
          </div>
        </div>
      )}

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

      {didAutofill && (
        <div className="lm-autofill-warning">
          <div className="lm-autofill-warning-title">⚠ Autofill is incomplete — review before saving</div>
          {autofillMissingHeroes > 0 && (
            <div className="lm-autofill-warning-line lm-autofill-warning-critical">
              {autofillMissingHeroes} hero{autofillMissingHeroes > 1 ? 'es' : ''} could not be identified —
              pick {autofillMissingHeroes > 1 ? 'them' : 'it'} in the highlighted slot{autofillMissingHeroes > 1 ? 's' : ''} below.
            </div>
          )}
          <div className="lm-autofill-warning-line">
            The scoreboard doesn't include <strong>final blows</strong>, <strong>time played</strong>,
            or battle-tag <strong>#IDs</strong> (e.g. <code>#1234</code>) — fill these in yourself.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="lm-form">

        {/* ── Scoreboard Upload ── */}
        <section className="lm-section lm-scoreboard-upload">
          <label className="lm-scoreboard-btn">
            {parsing ? 'Reading scoreboard…' : '📷 Upload Scoreboard'}
            <input
              type="file"
              accept="image/*"
              onChange={handleScoreboardUpload}
              disabled={parsing}
              style={{ display: 'none' }}
            />
          </label>
          <span className="lm-scoreboard-hint">
            Autofills heroes and stats for both teams. Review highlighted rows —
            final blows, time played, and battle-tag IDs (#1234) still need you.
          </span>
        </section>

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
              <label>Game Mode</label>
              <div className="lm-mode-btns">
                {(['ranked', 'unranked'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    className={`lm-mode-btn${form.game_mode === mode ? ' active' : ''}`}
                    onClick={() => setMatchField('game_mode', mode)}
                  >
                    {mode === 'ranked' ? 'Ranked' : 'Unranked'}
                  </button>
                ))}
              </div>
            </div>

            <div className="lm-field">
              <label>Team Size</label>
              <div className="lm-size-btns">
                {(['5v5', '6v6'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`lm-size-btn${form.team_size === size ? ' active' : ''}`}
                    onClick={() => setMatchField('team_size', size)}
                  >
                    {size}
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
            <section key={pi} className={`lm-section lm-player-section${compErrors.length ? ' lm-section-invalid' : ''}${autofilledRows.has(pi) ? ' lm-autofilled' : ''}${autofilledRows.has(pi) && !player.heroes[0]?.hero_name ? ' lm-autofilled-incomplete' : ''}`}>
              <div className="lm-player-header">
                <h3 className="lm-section-title">
                  {`Player ${pi + 1}`}
                  {autofilledRows.has(pi) && !player.heroes[0]?.hero_name && (
                    <span className="lm-row-incomplete-badge">needs hero</span>
                  )}
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
                        if (comp.total >= rules.totalPlayers) title = `${t === 'team1' ? 'Team 1' : 'Team 2'} is full (${rules.totalPlayers}/${rules.totalPlayers})`;
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
                    <div className={`lm-field lm-field-hero${heroNeedsPick(pi, hi, heroSlot) ? ' lm-field-needs-hero' : ''}`}>
                      <label>Hero{heroNeedsPick(pi, hi, heroSlot) ? ' ⚠' : ''}</label>
                      {hi === 0 ? (
                        <HeroSelect
                          value={heroSlot.hero_name}
                          onChange={v => handlePrimaryHeroChange(pi, v)}
                          heroRoleMap={heroRoleMap}
                          herosByRole={herosByRole}
                          availableRoles={availableRoles}
                        />
                      ) : (
                        <HeroSelect
                          value={heroSlot.hero_name}
                          onChange={v => setHeroField(pi, hi, 'hero_name', v)}
                          heroRoleMap={heroRoleMap}
                          herosByRole={herosByRole}
                          requiredRole={primaryRole}
                        />
                      )}
                      {heroNeedsPick(pi, hi, heroSlot) && (
                        <span className="lm-needs-hero-note">Not recognized — pick the hero</span>
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
