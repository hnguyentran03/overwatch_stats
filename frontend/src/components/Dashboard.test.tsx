import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Dashboard from './Dashboard';
import { getPlayerStats, getPlayerMatchOutcomes } from '../api/client';

// Mock the API client used by Dashboard.
jest.mock('../api/client');

// Mock the data-fetching child components so they don't make their own calls.
jest.mock('./HeroStats', () => () => <div>HeroStats Component</div>);
jest.mock('./MapStats', () => () => <div>MapStats Component</div>);
jest.mock('./TrendChart', () => () => <div>TrendChart Component</div>);
jest.mock('./MatchDetailModal', () => () => <div>MatchDetailModal</div>);
jest.mock('./LogMatch', () => ({ onCancel }: { onCancel: () => void }) => (
  <div>
    LogMatch Form
    <button onClick={onCancel}>back</button>
  </div>
));

const statsFixture = {
  total_matches: 10,
  wins: 6,
  losses: 3,
  draws: 1,
  win_percentage: 60.0,
  tank_win_percentage: null,
  tank_matches: 0,
  dps_win_percentage: 55.5,
  dps_matches: 5,
  dps_wins: 3,
  dps_losses: 2,
  dps_draws: 0,
  support_win_percentage: 80.0,
  support_matches: 5,
  support_wins: 4,
  support_losses: 1,
  support_draws: 0,
};

const outcomesFixture = { matches: [] };

beforeEach(() => {
  (getPlayerStats as jest.Mock).mockReset();
  (getPlayerMatchOutcomes as jest.Mock).mockReset();
  (getPlayerStats as jest.Mock).mockResolvedValue(statsFixture);
  (getPlayerMatchOutcomes as jest.Mock).mockResolvedValue(outcomesFixture);
});

describe('Dashboard', () => {
  test('shows loading then renders player stats', async () => {
    render(<Dashboard />);
    expect(screen.getByText('Loading player data...')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'PlayerOne#1234' })).toBeInTheDocument()
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('6W – 3L – 1D')).toBeInTheDocument();
  });

  test('renders dash for a role with no games', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByRole('heading', { name: 'PlayerOne#1234' }));
    // Tank win rate is null -> shows em dash and "No games".
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No games')).toBeInTheDocument();
  });

  test('shows not found message on 404', async () => {
    // The component logs the error via console.error on failure; silence it here.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getPlayerStats as jest.Mock).mockRejectedValue({ response: { status: 404 } });
    (getPlayerMatchOutcomes as jest.Mock).mockRejectedValue({ response: { status: 404 } });
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText(/No player found for/)).toBeInTheDocument()
    );
    errorSpy.mockRestore();
  });

  test('searching a new tag refetches data', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByRole('heading', { name: 'PlayerOne#1234' }));

    const input = screen.getByPlaceholderText('Name#1234');
    fireEvent.change(input, { target: { value: 'NewPlayer#5678' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'NewPlayer#5678' })).toBeInTheDocument()
    );
    expect(getPlayerStats).toHaveBeenLastCalledWith('NewPlayer#5678', 'all', 'all');
  });

  test('changing the mode filter refetches with that mode', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByRole('heading', { name: 'PlayerOne#1234' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ranked' }));

    await waitFor(() =>
      expect(getPlayerStats).toHaveBeenLastCalledWith('PlayerOne#1234', 'ranked', 'all')
    );
    expect(getPlayerMatchOutcomes).toHaveBeenLastCalledWith('PlayerOne#1234', 'ranked', 'all');
  });

  test('changing the size filter refetches with that size', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByRole('heading', { name: 'PlayerOne#1234' }));
    fireEvent.click(screen.getByRole('button', { name: '6v6' }));
    await waitFor(() =>
      expect(getPlayerStats).toHaveBeenLastCalledWith('PlayerOne#1234', 'all', '6v6')
    );
  });

  test('filter buttons expose aria-pressed for the active selection', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByRole('heading', { name: 'PlayerOne#1234' }));

    const modeGroup = screen.getByRole('group', { name: 'Game mode filter' });
    // Defaults to 'All' pressed.
    expect(within(modeGroup).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(modeGroup).getByRole('button', { name: 'Ranked' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(within(modeGroup).getByRole('button', { name: 'Ranked' }));

    await waitFor(() =>
      expect(within(modeGroup).getByRole('button', { name: 'Ranked' })).toHaveAttribute('aria-pressed', 'true')
    );
    expect(within(modeGroup).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('switching tabs renders the corresponding component', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByRole('heading', { name: 'PlayerOne#1234' }));

    fireEvent.click(screen.getByRole('button', { name: 'Hero Stats' }));
    expect(screen.getByText('HeroStats Component')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Map Stats' }));
    expect(screen.getByText('MapStats Component')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trends' }));
    expect(screen.getByText('TrendChart Component')).toBeInTheDocument();
  });

  test('Log Match button shows the form and Back returns to dashboard', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByRole('heading', { name: 'PlayerOne#1234' }));

    fireEvent.click(screen.getByText('+ Log Match'));
    expect(screen.getByText('LogMatch Form')).toBeInTheDocument();

    fireEvent.click(screen.getByText('back'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'PlayerOne#1234' })).toBeInTheDocument()
    );
  });
});
