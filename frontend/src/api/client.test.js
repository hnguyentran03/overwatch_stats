// Mock axios before importing the client so client.js picks up the mock.
jest.mock('axios', () => {
  const instance = { get: jest.fn(), post: jest.fn() };
  return {
    __esModule: true,
    default: { create: jest.fn(() => instance) },
    create: jest.fn(() => instance),
  };
});

import axios from 'axios';
import {
  getMatches,
  getPlayerStats,
  getWinPercentageByHero,
  getWinPercentageByMap,
  getMapTrends,
  getMatchDetails,
  createMatch,
} from './client';

// All exported helpers share the single mocked instance.
const instance = axios.create();

beforeEach(() => {
  instance.get.mockReset();
  instance.post.mockReset();
  instance.get.mockResolvedValue({ data: { ok: true } });
  instance.post.mockResolvedValue({ data: { match_id: 7 } });
});

describe('battle tag encoding', () => {
  test('encodes the # in battle tags', async () => {
    await getPlayerStats('PlayerOne#1234');
    expect(instance.get).toHaveBeenCalledWith('/players/PlayerOne%231234/stats');
  });

  test('encodes special characters in win_percentage/hero path', async () => {
    await getWinPercentageByHero('Name With Space#9999');
    const [url] = instance.get.mock.calls[0];
    expect(url).toContain('Name%20With%20Space%239999');
  });
});

describe('query params', () => {
  test('getMatches omits params when no dates given', async () => {
    await getMatches();
    expect(instance.get).toHaveBeenCalledWith('/matches', { params: {} });
  });

  test('getMatches includes start and end dates', async () => {
    await getMatches('2026-01-01', '2026-02-01');
    expect(instance.get).toHaveBeenCalledWith('/matches', {
      params: { start_date: '2026-01-01', end_date: '2026-02-01' },
    });
  });

  test('getWinPercentageByHero adds map_id only when provided', async () => {
    await getWinPercentageByHero('A#1', 5);
    expect(instance.get).toHaveBeenCalledWith(
      '/players/A%231/win_percentage/hero',
      { params: { map_id: 5 } }
    );
  });

  test('getWinPercentageByMap includes role and hero_id', async () => {
    await getWinPercentageByMap('A#1', 'tank', 3);
    expect(instance.get).toHaveBeenCalledWith(
      '/players/A%231/win_percentage/map',
      { params: { role: 'tank', hero_id: 3 } }
    );
  });

  test('getMapTrends defaults time_window to week', async () => {
    await getMapTrends('A#1');
    expect(instance.get).toHaveBeenCalledWith('/players/A%231/map_trends', {
      params: { time_window: 'week' },
    });
  });
});

describe('return values', () => {
  test('getMatchDetails returns response.data', async () => {
    instance.get.mockResolvedValue({ data: { match_id: 42 } });
    const result = await getMatchDetails(42);
    expect(result).toEqual({ match_id: 42 });
  });

  test('createMatch posts payload and returns data', async () => {
    const payload = { map_id: 1, outcome: 'win' };
    const result = await createMatch(payload);
    expect(instance.post).toHaveBeenCalledWith('/matches', payload);
    expect(result).toEqual({ match_id: 7 });
  });
});
