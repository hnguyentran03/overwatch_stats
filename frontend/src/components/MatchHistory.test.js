import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MatchHistory from './MatchHistory';

const makeMatch = (overrides = {}) => ({
  match_id: 1,
  date_time: '2026-01-15T14:30:00',
  map_name: "King's Row",
  map_type: 'Hybrid',
  primary_hero: 'Ana',
  primary_hero_role: 'support',
  heroes_played: [{ hero_name: 'Ana' }],
  outcome: 'win',
  final_score: '2-1',
  duration: 15.5,
  eliminations: 12,
  assists: 8,
  deaths: 4,
  damage_done: 5000,
  healing_done: 3000,
  ...overrides,
});

describe('MatchHistory', () => {
  test('shows empty state when no matches', () => {
    render(<MatchHistory matches={[]} />);
    expect(screen.getByText('No match history available.')).toBeInTheDocument();
  });

  test('shows empty state when matches is undefined', () => {
    render(<MatchHistory matches={undefined} />);
    expect(screen.getByText('No match history available.')).toBeInTheDocument();
  });

  test('renders match rows with key fields', () => {
    render(<MatchHistory matches={[makeMatch()]} />);
    expect(screen.getByText("King's Row")).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('✓ WIN')).toBeInTheDocument();
    expect(screen.getByText('12/8/4')).toBeInTheDocument();
  });

  test('renders loss and draw labels', () => {
    render(
      <MatchHistory
        matches={[
          makeMatch({ match_id: 1, outcome: 'loss' }),
          makeMatch({ match_id: 2, outcome: 'draw' }),
        ]}
      />
    );
    expect(screen.getByText('✗ LOSS')).toBeInTheDocument();
    expect(screen.getByText('= DRAW')).toBeInTheDocument();
  });

  test('formats duration as m:ss', () => {
    // 15.5 minutes -> 15:30
    render(<MatchHistory matches={[makeMatch({ duration: 15.5 })]} />);
    expect(screen.getByText('15:30')).toBeInTheDocument();
  });

  test('shows hero swap badge when more than one hero played', () => {
    render(
      <MatchHistory
        matches={[makeMatch({ heroes_played: [{ hero_name: 'Ana' }, { hero_name: 'Kiriko' }] })]}
      />
    );
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  test('shows dash for zero healing', () => {
    render(<MatchHistory matches={[makeMatch({ healing_done: 0 })]} />);
    const row = screen.getByText("King's Row").closest('tr');
    expect(within(row).getByText('-')).toBeInTheDocument();
  });

  test('calls onMatchClick with match id when row clicked', () => {
    const onMatchClick = jest.fn();
    render(<MatchHistory matches={[makeMatch({ match_id: 99 })]} onMatchClick={onMatchClick} />);
    fireEvent.click(screen.getByText("King's Row").closest('tr'));
    expect(onMatchClick).toHaveBeenCalledWith(99);
  });

  test('paginates with See More button', () => {
    const matches = Array.from({ length: 25 }, (_, i) =>
      makeMatch({ match_id: i + 1, map_name: `Map ${i + 1}` })
    );
    render(<MatchHistory matches={matches} />);

    // Only first 20 shown initially.
    expect(screen.getByText('Showing 20 of 25 Matches')).toBeInTheDocument();
    expect(screen.queryByText('Map 21')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/See More/));

    expect(screen.getByText('Showing 25 of 25 Matches')).toBeInTheDocument();
    expect(screen.getByText('Map 21')).toBeInTheDocument();
  });
});
