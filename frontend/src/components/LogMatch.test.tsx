import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LogMatch from './LogMatch';
import { getHeroes, getMaps, createMatch, parseScoreboard } from '../api/client';

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
  (getHeroes as jest.Mock).mockReset();
  (getMaps as jest.Mock).mockReset();
  (createMatch as jest.Mock).mockReset();
  (parseScoreboard as jest.Mock).mockReset();
  (getHeroes as jest.Mock).mockResolvedValue(HEROES);
  (getMaps as jest.Mock).mockResolvedValue(MAPS);
  (createMatch as jest.Mock).mockResolvedValue({ match_id: 1 });
});

const renderLogMatch = async () => {
  const onSuccess = jest.fn();
  const onCancel = jest.fn();
  render(<LogMatch onSuccess={onSuccess} onCancel={onCancel} />);
  await waitFor(() => screen.getByRole('heading', { name: 'Log Match' }));
  return { onSuccess, onCancel };
};

describe('LogMatch', () => {
  // team1 players occupy combobox indices 1..5, team2 players 6..10 (index 0 is the map select).
  const ROLE_FILL: Array<string> = ['Reinhardt', 'Genji', 'Tracer', 'Ana', 'Kiriko'];
  const fillValidFiveVFive = async () => {
    for (let i = 1; i < 10; i++) fireEvent.click(screen.getByText('+ Add Another Player'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 3-2'), { target: { value: '2-1' } });
    const tags = screen.getAllByPlaceholderText('Name#1234');
    tags.forEach((t, i) => fireEvent.change(t, { target: { value: `P${i}#100${i}` } }));
    // Move players 5..9 to Team 2 before assigning heroes (no heroes yet ⇒ no role-full block).
    for (let i = 5; i < 10; i++) {
      const section = tags[i].closest('.lm-player-section') as HTMLElement;
      fireEvent.click(within(section).getByRole('button', { name: 'Team 2' }));
    }
    // Assign primary heroes: same 1T/2D/2S fill for each team, in role-available order.
    // Re-query comboboxes on every iteration: the role-filtered <select> for a
    // later player is replaced by React after each change commits, so a stale
    // node reference silently drops subsequent fireEvent.change calls.
    for (let p = 0; p < 10; p++) {
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[p + 1], { target: { value: ROLE_FILL[p % 5] } });
    }
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Match' })).not.toBeDisabled()
    );
  };

  // Valid 6v6: 6 players/team, 2T/2D/2S (tanks at the cap of 2).
  const SIX_FILL: Array<string> = ['Reinhardt', 'Winston', 'Genji', 'Tracer', 'Ana', 'Kiriko'];
  const fillValidSixVSix = async () => {
    fireEvent.click(screen.getByRole('button', { name: '6v6' }));
    for (let i = 1; i < 12; i++) fireEvent.click(screen.getByText('+ Add Another Player'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 3-2'), { target: { value: '2-1' } });
    const tags = screen.getAllByPlaceholderText('Name#1234');
    tags.forEach((t, i) => fireEvent.change(t, { target: { value: `P${i}#100${i}` } }));
    for (let i = 6; i < 12; i++) {
      const section = tags[i].closest('.lm-player-section') as HTMLElement;
      fireEvent.click(within(section).getByRole('button', { name: 'Team 2' }));
    }
    const selects = screen.getAllByRole('combobox');
    for (let p = 0; p < 12; p++) {
      fireEvent.change(selects[p + 1], { target: { value: SIX_FILL[p % 6] } });
    }
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Match' })).not.toBeDisabled()
    );
  };

  test('submits the selected team size', async () => {
    await renderLogMatch();
    await fillValidSixVSix();
    fireEvent.click(screen.getByRole('button', { name: 'Save Match' }));
    await waitFor(() => expect(createMatch).toHaveBeenCalled());
    expect((createMatch as jest.Mock).mock.calls[0][0].team_size).toBe('6v6');
  });

  test('switching a valid 5v5 to 6v6 makes it invalid (needs 6 players)', async () => {
    await renderLogMatch();
    await fillValidFiveVFive();               // valid under 5v5
    fireEvent.click(screen.getByRole('button', { name: '6v6' }));
    // Each 5-player team is now short one player under 6v6.
    expect(screen.getByText(/Team 1: needs 6 players \(has 5\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Match' })).toBeDisabled();
  });

  test('6v6 dropdown stops offering Tank once a team has two tanks', async () => {
    await renderLogMatch();
    fireEvent.click(screen.getByRole('button', { name: '6v6' }));
    fireEvent.click(screen.getByText('+ Add Another Player'));   // 2 team1 players
    fireEvent.click(screen.getByText('+ Add Another Player'));   // 3 team1 players
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Reinhardt' } });
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: 'Winston' } });
    // Third player's primary-hero select should no longer include a Tank option.
    const thirdSelect = screen.getAllByRole('combobox')[3];
    expect(within(thirdSelect).queryByRole('option', { name: 'Reinhardt' })).toBeNull();
    expect(within(thirdSelect).queryByRole('option', { name: 'Genji' })).toBeInTheDocument();
  });

  test('submits the selected game mode', async () => {
    await renderLogMatch();
    await fillValidFiveVFive();
    fireEvent.click(screen.getByRole('button', { name: 'Unranked' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Match' }));
    await waitFor(() => expect(createMatch).toHaveBeenCalled());
    expect((createMatch as jest.Mock).mock.calls[0][0].game_mode).toBe('unranked');
  });

  test('shows loading initially', async () => {
    render(<LogMatch onSuccess={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    // Let the async load settle so state updates happen inside act().
    await waitFor(() => screen.getByRole('heading', { name: 'Log Match' }));
  });

  test('loads heroes and maps then shows the form', async () => {
    await renderLogMatch();
    expect(screen.getByText('Player 1')).toBeInTheDocument();
    // Map dropdown populated.
    expect(screen.getByRole('option', { name: "King's Row" })).toBeInTheDocument();
  });

  test('first player is generic with no prefilled battle tag', async () => {
    await renderLogMatch();
    const tagInput = screen.getByPlaceholderText('Name#1234');
    expect(tagInput).toHaveValue('');
    expect(screen.queryByText('Your Stats')).not.toBeInTheDocument();
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
    (getHeroes as jest.Mock).mockRejectedValue(new Error('boom'));
    (getMaps as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<LogMatch onSuccess={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText('Failed to load heroes/maps.')).toBeInTheDocument()
    );
  });

  test('uploading a scoreboard autofills all players', async () => {
    (parseScoreboard as jest.Mock).mockResolvedValue([
      { team: 'team1', battle_tag: 'IMTHETROOP', hero_name: 'Reinhardt',
        eliminations: 12, assists: 2, deaths: 9,
        damage_done: 5953, healing_done: 4047, damage_mitigated: 760 },
      { team: 'team2', battle_tag: 'SEETHINGS', hero_name: 'Winston',
        eliminations: 18, assists: 7, deaths: 13,
        damage_done: 12057, healing_done: 1240, damage_mitigated: 6515 },
    ]);
    await renderLogMatch();

    const file = new File(['x'], 'scoreboard.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => screen.getByDisplayValue('IMTHETROOP'));
    expect(screen.getByDisplayValue('SEETHINGS')).toBeInTheDocument();
    // Reinhardt elims read into the first player's elims field.
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();
  });

  test('prominently flags an unidentified hero after autofill', async () => {
    (parseScoreboard as jest.Mock).mockResolvedValue([
      { team: 'team1', battle_tag: 'AAA', hero_name: 'Reinhardt',
        eliminations: 5, assists: 1, deaths: 2, damage_done: 1, healing_done: 0, damage_mitigated: 1 },
      { team: 'team2', battle_tag: 'BBB', hero_name: 'NotARealHero',
        eliminations: 9, assists: 2, deaths: 3, damage_done: 2, healing_done: 0, damage_mitigated: 0 },
    ]);
    await renderLogMatch();

    const file = new File(['x'], 'scoreboard.png', { type: 'image/png' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });

    // Top banner + per-row flags for the hero that couldn't be identified.
    await waitFor(() => screen.getByText(/Autofill is incomplete/i));
    expect(screen.getByText(/could not be identified/i)).toBeInTheDocument();
    expect(screen.getByText('needs hero')).toBeInTheDocument();
    expect(screen.getByText('Not recognized — pick the hero')).toBeInTheDocument();
  });

  test('shows a non-closable reading modal while parsing, removed when done', async () => {
    let resolveParse!: (value: unknown) => void;
    (parseScoreboard as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveParse = resolve; }));
    await renderLogMatch();

    const file = new File(['x'], 'scoreboard.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });

    // Modal is visible and offers no way to dismiss it.
    await waitFor(() => screen.getByText('This can take a few seconds. Please wait.'));
    expect(screen.queryByRole('button', { name: '✕' })).not.toBeInTheDocument();

    // Finishing the read removes the modal.
    resolveParse([]);
    await waitFor(() =>
      expect(screen.queryByText('This can take a few seconds. Please wait.')).not.toBeInTheDocument()
    );
  });

  test('surfaces the backend error message when scoreboard parsing fails', async () => {
    (parseScoreboard as jest.Mock).mockRejectedValue({
      response: { data: { error: 'Scoreboard parsing is not configured. Set the ANTHROPIC_API_KEY environment variable.' } },
    });
    await renderLogMatch();

    const file = new File(['x'], 'scoreboard.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => screen.getByText(/not configured/i));
  });
});
