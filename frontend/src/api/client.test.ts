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
  parseScoreboard,
} from './client';
import type { CreateMatchPayload } from '../types';

// All exported helpers share the single mocked instance.
const instance = axios.create();

beforeEach(() => {
  (instance.get as jest.Mock).mockReset();
  (instance.post as jest.Mock).mockReset();
  (instance.get as jest.Mock).mockResolvedValue({ data: { ok: true } });
  (instance.post as jest.Mock).mockResolvedValue({ data: { match_id: 7 } });
});

describe('battle tag encoding', () => {
  test('encodes the # in battle tags', async () => {
    await getPlayerStats('PlayerOne#1234');
    expect(instance.get).toHaveBeenCalledWith('/players/PlayerOne%231234/stats', { params: {} });
  });

  test('encodes special characters in win_percentage/hero path', async () => {
    await getWinPercentageByHero('Name With Space#9999');
    const [url] = (instance.get as jest.Mock).mock.calls[0];
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

  test('getPlayerStats adds mode only when not "all"', async () => {
    await getPlayerStats('A#1', 'ranked');
    expect(instance.get).toHaveBeenCalledWith('/players/A%231/stats', {
      params: { mode: 'ranked' },
    });
  });
});

describe('return values', () => {
  test('getMatchDetails returns response.data', async () => {
    (instance.get as jest.Mock).mockResolvedValue({ data: { match_id: 42 } });
    const result = await getMatchDetails(42);
    expect(result).toEqual({ match_id: 42 });
  });

  test('createMatch posts payload and returns data', async () => {
    const payload: CreateMatchPayload = {
      date_time: '2026-01-01T00:00:00',
      map_id: 1,
      outcome: 'win',
      game_mode: 'ranked',
      team_size: '5v5',
      final_score: '2-1',
      duration: 15,
      players: [],
      bans: { team1: [], team2: [] },
    };
    const result = await createMatch(payload);
    expect(instance.post).toHaveBeenCalledWith('/matches', payload);
    expect(result).toEqual({ match_id: 7 });
  });
});

describe('parseScoreboard', () => {
  test('posts the image as multipart and returns players', async () => {
    const players = [{ team: 'team1', battle_tag: 'IMTHETROOP', hero_name: 'Reinhardt' }];
    (instance.post as jest.Mock).mockResolvedValue({ data: { players } });
    const file = new File(['x'], 'scoreboard.png', { type: 'image/png' });

    const result = await parseScoreboard(file);

    expect(result).toEqual(players);
    const [url, body, config] = (instance.post as jest.Mock).mock.calls[0];
    expect(url).toBe('/matches/parse_scoreboard');
    expect(body).toBeInstanceOf(FormData);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });
});
