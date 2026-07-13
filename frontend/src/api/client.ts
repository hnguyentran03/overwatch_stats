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

export const getMatches = async (
  startDate?: string,
  endDate?: string
): Promise<MatchesResponse> => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const response = await apiClient.get('/matches', { params });
  return response.data;
};

export const getPlayerStats = async (battleTag: string): Promise<PlayerStats> => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/stats`);
  return response.data;
};

export const getPlayerMatchOutcomes = async (
  battleTag: string
): Promise<MatchOutcomesResponse> => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/match_outcomes`);
  return response.data;
};

export const getWinPercentageByHero = async (
  battleTag: string,
  mapId: number | null = null
): Promise<HeroStatsResponse> => {
  const params: Record<string, number> = {};
  if (mapId) params.map_id = mapId;
  const response = await apiClient.get(
    `/players/${encodeTag(battleTag)}/win_percentage/hero`,
    { params }
  );
  return response.data;
};

export const getWinPercentageByMap = async (
  battleTag: string,
  role: Role | null = null,
  heroId: number | string | null = null
): Promise<MapStatsResponse> => {
  const params: Record<string, string | number> = {};
  if (role) params.role = role;
  if (heroId) params.hero_id = heroId;
  const response = await apiClient.get(
    `/players/${encodeTag(battleTag)}/win_percentage/map`,
    { params }
  );
  return response.data;
};

export const getMapStats = async (
  battleTag: string,
  mapId: number
): Promise<MapDetail> => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/map_stats/${mapId}`);
  return response.data;
};

export const getMapTrends = async (
  battleTag: string,
  timeWindow: 'day' | 'week' | 'month' = 'week',
  role: Role | null = null
): Promise<MapTrendsResponse> => {
  const params: Record<string, string> = { time_window: timeWindow };
  if (role) params.role = role;
  const response = await apiClient.get(
    `/players/${encodeTag(battleTag)}/map_trends`,
    { params }
  );
  return response.data;
};

export const getPreferredHeroes = async (
  battleTag: string,
  mapId: number
): Promise<PreferredHeroesResponse> => {
  const response = await apiClient.get(
    `/players/${encodeTag(battleTag)}/preferred_heroes/${mapId}`
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
