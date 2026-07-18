// Domain types mirroring the Flask backend JSON responses.
// Verified against backend/routes/{matches,players,stats}.py and utils/calculations.py.

export type Role = 'tank' | 'dps' | 'support';
export type Outcome = 'win' | 'loss' | 'draw';
export type Team = 'team1' | 'team2';
export type GameMode = 'ranked' | 'unranked';
export type ModeFilter = 'all' | GameMode;
export type TeamSize = '5v5' | '6v6';
export type SizeFilter = 'all' | TeamSize;
export type MapType = 'Hybrid' | 'Control' | 'Escort' | 'Flashpoint' | 'Push';

// ── Reference entities ──
export interface Hero {
  hero_id: number;
  hero_name: string;
  role: Role;
}

export interface GameMap {
  map_id: number;
  map_name: string;
  map_type: MapType;
}

// ── Shared computed shapes (utils/calculations.py) ──
export interface WinStats {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  win_percentage: number;
}

export interface HeroPerformanceStats {
  games_played: number;
  total_eliminations: number;
  total_final_blows: number;
  total_assists: number;
  total_deaths: number;
  total_damage_done: number;
  total_healing_done: number;
  total_damage_mitigated: number;
  total_time_played: number;
  avg_eliminations: number;
  avg_final_blows: number;
  avg_assists: number;
  avg_deaths: number;
  avg_damage_done: number;
  avg_healing_done: number;
  avg_damage_mitigated: number;
  elims_per_10: number;
  final_blows_per_10: number;
  assists_per_10: number;
  deaths_per_10: number;
  damage_per_10: number;
  healing_per_10: number;
  mitigation_per_10: number;
}

// ── /players/<tag>/stats ──
// aggregate_hero_stats fields + per-role win breakdown (role win% may be null).
export type PlayerStats = {
  battle_tag: string;
  total_matches: number;
  wins: number;
  losses: number;
  draws: number;
  win_percentage: number;
  tank_matches: number;
  tank_wins: number;
  tank_losses: number;
  tank_draws: number;
  tank_win_percentage: number | null;
  dps_matches: number;
  dps_wins: number;
  dps_losses: number;
  dps_draws: number;
  dps_win_percentage: number | null;
  support_matches: number;
  support_wins: number;
  support_losses: number;
  support_draws: number;
  support_win_percentage: number | null;
} & HeroPerformanceStats;

// ── /matches (list) ──
export interface MatchListItem {
  match_id: number;
  date_time: string;
  map_id: number;
  map_name: string;
  map_type: MapType;
  final_score: string;
  outcome: Outcome;
  game_mode: GameMode;
  team_size: TeamSize;
}
export interface MatchesResponse {
  matches: MatchListItem[];
  count: number;
}

// ── /players/<tag>/match_outcomes ──
export interface HeroPlayedSlot {
  hero_name: string;
  hero_role: Role;
  time_played: number;
}
export interface MatchOutcome {
  match_id: number;
  date_time: string;
  map_name: string;
  map_type: MapType;
  outcome: Outcome;
  final_score: string;
  duration: number;
  primary_hero: string;
  primary_hero_role: Role;
  heroes_played: HeroPlayedSlot[];
  eliminations: number;
  assists: number;
  deaths: number;
  damage_done: number;
  healing_done: number;
  damage_mitigated: number;
  game_mode: GameMode;
  team_size: TeamSize;
}
export interface MatchOutcomesResponse {
  battle_tag: string;
  matches: MatchOutcome[];
  count: number;
}

// ── /players/<tag>/win_percentage/hero ──
// win_percentage/hero returns win stats + performance totals/avgs/per10 (no games_played).
export type HeroStat = {
  hero_id: number;
  hero_name: string;
  role: Role;
} & WinStats & Omit<HeroPerformanceStats, 'games_played'>;
export interface HeroStatsResponse {
  battle_tag: string;
  hero_stats: HeroStat[];
}

// ── /players/<tag>/win_percentage/map ──
export type MapStat = {
  map_id: number;
  map_name: string;
  map_type: MapType;
} & WinStats;
export interface MapStatsResponse {
  battle_tag: string;
  map_stats: MapStat[];
}

// ── /players/<tag>/map_stats/<map_id> ──
export type HeroStatOnMap = {
  hero_name: string;
  role: Role;
} & WinStats & HeroPerformanceStats;
export type MapDetail = {
  battle_tag: string;
  map_id: number;
  map_name: string;
  map_type: MapType;
  heroes_played: HeroStatOnMap[];
} & WinStats & HeroPerformanceStats;

// ── /players/<tag>/map_trends ──
export interface TrendPeriod {
  period_start: string;
  period_end: string;
  matches_played: number;
  wins: number;
  losses: number;
  win_percentage: number;
}
export interface MapTrend {
  map_id: number;
  map_name: string;
  map_type: MapType;
  trends: TrendPeriod[];
}
export interface MapTrendsResponse {
  battle_tag: string;
  time_window: 'day' | 'week' | 'month';
  map_trends: MapTrend[];
  weakest_maps: MapStat[];
}

// ── /players/<tag>/preferred_heroes/<map_id> ──
export interface PreferredHero {
  hero_id: number;
  hero_name: string;
  role: Role;
  games_played: number;
  total_time_played: number;
}
export interface PreferredHeroesResponse {
  battle_tag: string;
  map_id: number;
  map_name: string;
  preferred_heroes: PreferredHero[];
}

// ── /matches/<id>/details ──
export interface BanInfo {
  hero_name: string;
  role: Role;
}
export interface HeroSlotDetail {
  hero_name: string;
  hero_role: Role;
  time_played: number;
  eliminations: number;
  final_blows: number;
  assists: number;
  deaths: number;
  damage_done: number;
  healing_done: number;
  damage_mitigated: number;
}
export interface MatchDetailPlayer {
  player_id: number;
  battle_tag: string;
  team: Team;
  primary_hero: string;
  primary_hero_role: Role;
  heroes: HeroSlotDetail[];
  eliminations: number;
  final_blows: number;
  assists: number;
  deaths: number;
  damage_done: number;
  healing_done: number;
  damage_mitigated: number;
}
export interface MatchDetails {
  match_id: number;
  date_time: string;
  map_name: string;
  map_type: MapType;
  final_score: string;
  outcome: Outcome;
  duration: number;
  players: MatchDetailPlayer[];
  bans: { team1: BanInfo[]; team2: BanInfo[] };
  game_mode: GameMode;
  team_size: TeamSize;
}

// ── /matches/<id>/banned_heroes ──
export interface BanFull {
  hero_id: number;
  hero_name: string;
  role: Role;
}
export interface BannedHeroesResponse {
  match_id: number;
  team1_bans: BanFull[];
  team2_bans: BanFull[];
}

// ── POST /matches ──
export interface CreateMatchPayload {
  date_time: string;
  map_id: number;
  outcome: Outcome;
  game_mode: GameMode;
  final_score: string;
  duration: number;
  players: {
    battle_tag: string;
    team: Team;
    heroes: {
      hero_name: string;
      time_played: number;
      eliminations: number;
      final_blows: number;
      assists: number;
      deaths: number;
      damage_done: number;
      healing_done: number;
      damage_mitigated: number;
    }[];
  }[];
  bans: { team1: string[]; team2: string[] };
}
export interface CreateMatchResponse {
  match_id: number;
  message: string;
}

// ── POST /matches/parse_scoreboard (scoreboard autofill) ──
// One player parsed from a scoreboard screenshot. Mirrors the backend
// ScoreboardPlayer model in backend/utils/scoreboard.py. hero_name is "" when
// the hero could not be confidently identified; final_blows/time_played are not
// present on a scoreboard.
export interface ScoreboardPlayer {
  team: Team;
  battle_tag: string;
  hero_name: string;
  eliminations: number;
  assists: number;
  deaths: number;
  damage_done: number;
  healing_done: number;
  damage_mitigated: number;
}
