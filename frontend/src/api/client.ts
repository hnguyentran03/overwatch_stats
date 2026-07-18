import axios, { AxiosInstance } from 'axios';
import type {
  MatchesResponse,
  PlayerStats,
  MatchOutcomesResponse,
  HeroStatsResponse,
  MapStatsResponse,
  MapDetail,
  MapTrendsResponse,
  PreferredHeroesResponse,
  MatchDetails,
  BannedHeroesResponse,
  Hero,
  GameMap,
  CreateMatchPayload,
  CreateMatchResponse,
  ScoreboardPlayer,
  Role,
  ModeFilter,
  SizeFilter,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Battle.net IDs contain '#' which must be percent-encoded in URLs
const encodeTag = (battleTag: string): string => encodeURIComponent(battleTag);

const appendMode = (params: Record<string, string | number>, mode: ModeFilter) => {
  if (mode !== 'all') params.mode = mode;
};

const appendSize = (params: Record<string, string | number>, size: SizeFilter) => {
  if (size !== 'all') params.size = size;
};

export const getMatches = async (
  startDate?: string,
  endDate?: string,
  mode: ModeFilter = 'all',
  size: SizeFilter = 'all'
): Promise<MatchesResponse> => {
  const params: Record<string, string | number> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  appendMode(params, mode);
  appendSize(params, size);
  const response = await apiClient.get('/matches', { params });
  return response.data;
};

export const getPlayerStats = async (
  battleTag: string,
  mode: ModeFilter = 'all',
  size: SizeFilter = 'all'
): Promise<PlayerStats> => {
  const params: Record<string, string | number> = {};
  appendMode(params, mode);
  appendSize(params, size);
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/stats`, { params });
  return response.data;
};

export const getPlayerMatchOutcomes = async (
  battleTag: string,
  mode: ModeFilter = 'all',
  size: SizeFilter = 'all'
): Promise<MatchOutcomesResponse> => {
  const params: Record<string, string | number> = {};
  appendMode(params, mode);
  appendSize(params, size);
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/match_outcomes`, {
    params,
  });
  return response.data;
};

export const getWinPercentageByHero = async (
  battleTag: string,
  mapId: number | null = null,
  mode: ModeFilter = 'all',
  size: SizeFilter = 'all'
): Promise<HeroStatsResponse> => {
  const params: Record<string, string | number> = {};
  if (mapId) params.map_id = mapId;
  appendMode(params, mode);
  appendSize(params, size);
  const response = await apiClient.get(
    `/players/${encodeTag(battleTag)}/win_percentage/hero`,
    { params }
  );
  return response.data;
};

export const getWinPercentageByMap = async (
  battleTag: string,
  role: Role | null = null,
  heroId: number | string | null = null,
  mode: ModeFilter = 'all',
  size: SizeFilter = 'all'
): Promise<MapStatsResponse> => {
  const params: Record<string, string | number> = {};
  if (role) params.role = role;
  if (heroId) params.hero_id = heroId;
  appendMode(params, mode);
  appendSize(params, size);
  const response = await apiClient.get(
    `/players/${encodeTag(battleTag)}/win_percentage/map`,
    { params }
  );
  return response.data;
};

export const getMapStats = async (
  battleTag: string,
  mapId: number,
  mode: ModeFilter = 'all',
  size: SizeFilter = 'all'
): Promise<MapDetail> => {
  const params: Record<string, string | number> = {};
  appendMode(params, mode);
  appendSize(params, size);
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/map_stats/${mapId}`, {
    params,
  });
  return response.data;
};

export const getMapTrends = async (
  battleTag: string,
  timeWindow: 'day' | 'week' | 'month' = 'week',
  role: Role | null = null,
  mode: ModeFilter = 'all',
  size: SizeFilter = 'all'
): Promise<MapTrendsResponse> => {
  const params: Record<string, string | number> = { time_window: timeWindow };
  if (role) params.role = role;
  appendMode(params, mode);
  appendSize(params, size);
  const response = await apiClient.get(
    `/players/${encodeTag(battleTag)}/map_trends`,
    { params }
  );
  return response.data;
};

export const getPreferredHeroes = async (
  battleTag: string,
  mapId: number,
  mode: ModeFilter = 'all',
  size: SizeFilter = 'all'
): Promise<PreferredHeroesResponse> => {
  const params: Record<string, string | number> = {};
  appendMode(params, mode);
  appendSize(params, size);
  const response = await apiClient.get(
    `/players/${encodeTag(battleTag)}/preferred_heroes/${mapId}`,
    { params }
  );
  return response.data;
};

export const getMatchDetails = async (matchId: number): Promise<MatchDetails> => {
  const response = await apiClient.get(`/matches/${matchId}/details`);
  return response.data;
};

export const getBannedHeroes = async (
  matchId: number
): Promise<BannedHeroesResponse> => {
  const response = await apiClient.get(`/matches/${matchId}/banned_heroes`);
  return response.data;
};

export const getHeroes = async (): Promise<Hero[]> => {
  const response = await apiClient.get('/heroes');
  return response.data;
};

export const getMaps = async (): Promise<GameMap[]> => {
  const response = await apiClient.get('/maps');
  return response.data;
};

export const createMatch = async (
  matchData: CreateMatchPayload
): Promise<CreateMatchResponse> => {
  const response = await apiClient.post('/matches', matchData);
  return response.data;
};

export const parseScoreboard = async (file: File): Promise<ScoreboardPlayer[]> => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post('/matches/parse_scoreboard', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.players;
};

export default apiClient;
