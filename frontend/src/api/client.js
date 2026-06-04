import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getMatches = async (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const response = await apiClient.get('/matches', { params });
  return response.data;
};

export const getPlayerStats = async (playerId) => {
  const response = await apiClient.get(`/players/${playerId}/stats`);
  return response.data;
};

export const getPlayerMatchOutcomes = async (playerId) => {
  const response = await apiClient.get(`/players/${playerId}/match_outcomes`);
  return response.data;
};

export const getWinPercentageByHero = async (playerId) => {
  const response = await apiClient.get(`/players/${playerId}/win_percentage/hero`);
  return response.data;
};

export const getWinPercentageByMap = async (playerId) => {
  const response = await apiClient.get(`/players/${playerId}/win_percentage/map`);
  return response.data;
};

export const getMapStats = async (playerId, mapId) => {
  const response = await apiClient.get(`/players/${playerId}/map_stats/${mapId}`);
  return response.data;
};

export const getMapTrends = async (playerId, timeWindow = 'week') => {
  const response = await apiClient.get(`/players/${playerId}/map_trends`, {
    params: { time_window: timeWindow }
  });
  return response.data;
};

export const getPreferredHeroes = async (playerId, mapId) => {
  const response = await apiClient.get(`/players/${playerId}/preferred_heroes/${mapId}`);
  return response.data;
};

export const getBannedHeroes = async (matchId) => {
  const response = await apiClient.get(`/matches/${matchId}/banned_heroes`);
  return response.data;
};

export default apiClient;
