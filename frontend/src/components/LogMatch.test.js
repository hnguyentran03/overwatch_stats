import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LogMatch from './LogMatch';
import { getHeroes, getMaps, createMatch } from '../api/client';

jest.mock('../api/client');

const HEROES = [
  { hero_id: 1, hero_name: 'Reinhardt', role: 'tank' },
  { hero_id: 2, hero_name: 'Winston', role: 'tank' },
  { hero_id: 3, hero_name: 'Genji', role: 'dps' },
  { hero_id: 4, hero_name: 'Tracer', role: 'dps' },
  { hero_id: 5, hero_name: 'Ana', role: 'support' },
  { hero_id: 6, hero_name: 'Kiriko', role: 'support' },
];

const MAPS = [
  { map_id: 1, map_name: "King's Row", map_type: 'Hybrid' },
  { map_id: 2, map_name: 'Ilios', map_type: 'Control' },
];

beforeEach(() => {
  getHeroes.mockReset();
  getMaps.mockReset();
  createMatch.mockReset();
  getHeroes.mockResolvedValue(HEROES);
  getMaps.mockResolvedValue(MAPS);
  createMatch.mockResolvedValue({ match_id: 1 });
});

const renderLogMatch = async (props = {}) => {
  const onSuccess = jest.fn();
  const onCancel = jest.fn();
  render(<LogMatch onSuccess={onSuccess} onCancel={onCancel} {...props} />);
  await waitFor(() => screen.getByRole('heading', { name: 'Log Match' }));
  return { onSuccess, onCancel };
};

describe('LogMatch', () => {
  test('shows loading initially', async () => {
    render(<LogMatch onSuccess={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    // Let the async load settle so state updates happen inside act().
    await waitFor(() => screen.getByRole('heading', { name: 'Log Match' }));
  });

  test('loads heroes and maps then shows the form', async () => {
    await renderLogMatch();
    expect(screen.getByText('Your Stats')).toBeInTheDocument();
    // Map dropdown populated.
    expect(screen.getByRole('option', { name: "King's Row" })).toBeInTheDocument();
  });

  test('prefills the default battle tag', async () => {
    await renderLogMatch({ defaultBattleTag: 'Me#1234' });
    expect(screen.getByDisplayValue('Me#1234')).toBeInTheDocument();
  });

  test('shows composition errors and disables submit for an incomplete team', async () => {
    await renderLogMatch();
    expect(screen.getByText(/Team 1: needs 1 Tank \(has 0\)/)).toBeInTheDocument();
    expect(screen.getByText(/Team 2: needs 2 Supports \(has 0\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Match' })).toBeDisabled();
  });

  test('selecting a tank clears that team\'s tank error', async () => {
    await renderLogMatch();
    // combobox 0 = map, combobox 1 = player 1 primary hero select.
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'Reinhardt' } });

    await waitFor(() =>
      expect(screen.queryByText(/Team 1: needs 1 Tank/)).not.toBeInTheDocument()
    );
    // Still needs damage/support, so submit stays disabled.
    expect(screen.getByRole('button', { name: 'Save Match' })).toBeDisabled();
  });

  test('Add Another Player adds a player section', async () => {
    await renderLogMatch();
    expect(screen.queryByText('Player 2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Add Another Player'));
    expect(screen.getByText('Player 2')).toBeInTheDocument();
  });

  test('Add Hero Swap is disabled until a primary hero is chosen', async () => {
    await renderLogMatch();
    const addSwap = screen.getByRole('button', { name: '+ Add Hero Swap' });
    expect(addSwap).toBeDisabled();

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'Reinhardt' } });

    await waitFor(() => expect(addSwap).not.toBeDisabled());
  });

  test('cancel calls onCancel', async () => {
    const { onCancel } = await renderLogMatch();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  test('shows error when heroes/maps fail to load', async () => {
    getHeroes.mockRejectedValue(new Error('boom'));
    getMaps.mockRejectedValue(new Error('boom'));
    render(<LogMatch onSuccess={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText('Failed to load heroes/maps.')).toBeInTheDocument()
    );
  });
});
