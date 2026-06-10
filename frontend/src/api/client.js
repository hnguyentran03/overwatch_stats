import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Battle.net IDs contain '#' which must be percent-encoded in URLs
const encodeTag = (battleTag) => encodeURIComponent(battleTag);

export const getMatches = async (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const response = await apiClient.get('/matches', { params });
  return response.data;
};

export const getPlayerStats = async (battleTag) => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/stats`);
  return response.data;
};

export const getPlayerMatchOutcomes = async (battleTag) => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/match_outcomes`);
  return response.data;
};

export const getWinPercentageByHero = async (battleTag) => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/win_percentage/hero`);
  return response.data;
};

export const getWinPercentageByMap = async (battleTag) => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/win_percentage/map`);
  return response.data;
};

export const getMapStats = async (battleTag, mapId) => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/map_stats/${mapId}`);
  return response.data;
};

export const getMapTrends = async (battleTag, timeWindow = 'week') => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/map_trends`, {
    params: { time_window: timeWindow }
  });
  return response.data;
};

export const getPreferredHeroes = async (battleTag, mapId) => {
  const response = await apiClient.get(`/players/${encodeTag(battleTag)}/preferred_heroes/${mapId}`);
  return response.data;
};

export const getBannedHeroes = async (matchId) => {
  const response = await apiClient.get(`/matches/${matchId}/banned_heroes`);
  return response.data;
};

export default apiClient;
